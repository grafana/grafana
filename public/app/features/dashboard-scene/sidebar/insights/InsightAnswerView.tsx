import { css } from '@emotion/css';
import { useState } from 'react';

import { dateTimeFormat, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { InsightInvestigationView } from './InsightInvestigationView';
import { InsightSourceLinks } from './InsightSourceLinks';
import { canStartInvestigation } from './investigation';
import { getInsightExploreUrl, revealInsightSourcePanel } from './navigation';
import { type InsightSourcePanel } from './sources';
import { type InsightEvidence, type InsightInvestigation, type InsightResult } from './types';

const UTC_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const WINDOW_FORMAT = 'MMM D, HH:mm';

export interface InsightShareControl {
  canShare: boolean;
  sharing: boolean;
  error?: string;
  onShare: () => void;
}

export interface InsightInvestigateControl {
  investigation?: InsightInvestigation;
  /** The Assistant cannot start investigations here; an earlier failure still shows its explanation. */
  unavailable: boolean;
  onInvestigate: () => void;
}

interface Props {
  result: InsightResult;
  sources: InsightSourcePanel[];
  /** Omitted when the answer cannot be followed up, such as a shared answer without its captured values. */
  onFollowUp?: () => void;
  /** Main answers can be shared; follow-up answers cannot. */
  share?: InsightShareControl;
  /** Main answers can start an investigation; follow-up answers cannot. */
  investigate?: InsightInvestigateControl;
}

export function InsightAnswerView({ result, sources, onFollowUp, share, investigate }: Props) {
  const styles = useStyles2(getStyles);
  const { content, snapshot } = result;
  const breakdownVariable = snapshot.breakdown?.variable;
  const omittedValues = snapshot.breakdown?.omittedValues ?? 0;

  return (
    <Stack direction="column" gap={1.5}>
      {result.share && (
        <Text variant="bodySmall" color="secondary">
          {t('dashboard.insights.answer.shared-by', 'Shared by {{login}} · {{time}}', {
            login: result.share.login,
            time: dateTimeFormat(result.share.sharedAt, { format: WINDOW_FORMAT }),
          })}
        </Text>
      )}
      <Text element="p" weight="medium">
        {content.headline}
      </Text>
      {content.breakdown && breakdownVariable && (
        <div className={styles.breakdown}>
          <Text variant="bodySmall" weight="medium">
            {t('dashboard.insights.answer.breakdown-title', 'By {{variable}}', { variable: breakdownVariable })}
          </Text>
          <ul className={styles.breakdownList}>
            {content.breakdown.map((item) => (
              <li key={item.value}>
                <Text variant="bodySmall" weight="medium">
                  {item.value}
                </Text>{' '}
                <Text variant="bodySmall" color="secondary">
                  {item.headline}
                </Text>
              </li>
            ))}
          </ul>
          {omittedValues > 0 && (
            <Text variant="bodySmall" color="secondary">
              {t('dashboard.insights.answer.breakdown-omitted', '', {
                count: omittedValues,
                defaultValue_one: '{{count}} more value was left out.',
                defaultValue_other: '{{count}} more values were left out.',
              })}
            </Text>
          )}
        </div>
      )}
      <ul className={styles.findings}>
        {content.findings.map((finding, index) => (
          <li key={index}>
            <Text weight="medium">{finding.label}</Text>
            <Text element="p" color="secondary">
              {finding.detail}
            </Text>
            {finding.evidence && (
              <InsightEvidenceLinks evidence={finding.evidence} snapshot={result.snapshot} sources={sources} />
            )}
          </li>
        ))}
      </ul>
      {content.caveat && (
        <div className={styles.caveat}>
          <Text variant="bodySmall" weight="medium">
            <Trans i18nKey="dashboard.insights.answer.caveat-title">Keep in mind</Trans>
          </Text>
          <Text element="p" variant="bodySmall" color="secondary">
            {content.caveat}
          </Text>
        </div>
      )}
      <details className={styles.details}>
        <summary className={styles.summary}>
          {t('dashboard.insights.answer.footer', '', {
            count: snapshot.panels.length,
            time: dateTimeFormat(result.completedAt, { format: 'HH:mm' }),
            defaultValue_one: '{{count}} source panel · Answered {{time}}',
            defaultValue_other: '{{count}} source panels · Answered {{time}}',
          })}
        </summary>
        <div className={styles.detailsBody}>
          <Text element="p" variant="bodySmall" color="secondary">
            {t('dashboard.insights.answer.time-range', 'Time range (UTC): {{from}} to {{to}}', {
              from: dateTimeFormat(snapshot.from, { timeZone: 'utc', format: UTC_FORMAT }),
              to: dateTimeFormat(snapshot.to, { timeZone: 'utc', format: UTC_FORMAT }),
            })}
          </Text>
          {snapshot.previousPeriod && (
            <Text element="p" variant="bodySmall" color="secondary">
              {t('dashboard.insights.answer.previous-period', 'Compared with (UTC): {{from}} to {{to}}', {
                from: dateTimeFormat(snapshot.previousPeriod.from, { timeZone: 'utc', format: UTC_FORMAT }),
                to: dateTimeFormat(snapshot.previousPeriod.to, { timeZone: 'utc', format: UTC_FORMAT }),
              })}
            </Text>
          )}
          {snapshot.breakdown && (
            <Text element="p" variant="bodySmall" color="secondary">
              {t('dashboard.insights.answer.breakdown-values', 'Broken down by {{variable}}: {{values}}', {
                variable: snapshot.breakdown.variable,
                values: snapshot.breakdown.values.map((value) => value.text).join(', '),
              })}
            </Text>
          )}
          {snapshot.annotations?.length ? (
            <Text element="p" variant="bodySmall" color="secondary">
              {t('dashboard.insights.answer.annotations', '', {
                count: snapshot.annotations.length,
                defaultValue_one: 'Included {{count}} annotation',
                defaultValue_other: 'Included {{count}} annotations',
              })}
            </Text>
          ) : null}
          {result.framesOmitted && (
            <Text element="p" variant="bodySmall" color="secondary">
              <Trans i18nKey="dashboard.insights.answer.frames-omitted">
                This shared answer was stored without its source data, so it cannot be followed up. Ask again to follow
                up.
              </Trans>
            </Text>
          )}
          <InsightSourceLinks items={snapshot.panels} sources={sources} />
        </div>
      </details>
      <div className={styles.actions}>
        <Stack direction="row" gap={0.5} alignItems="center" wrap="wrap">
          {onFollowUp && (
            <Button size="sm" variant="secondary" fill="text" icon="comment-alt-message" onClick={onFollowUp}>
              <Trans i18nKey="dashboard.insights.answer.follow-up">Ask a follow-up</Trans>
            </Button>
          )}
          {share?.canShare && !result.share && (
            <Button
              size="sm"
              variant="secondary"
              fill="text"
              icon={share.sharing ? 'spinner' : 'share-alt'}
              disabled={share.sharing}
              tooltip={t(
                'dashboard.insights.answer.share-tooltip',
                'Show this answer to everyone who opens the dashboard, until someone shares a newer one'
              )}
              onClick={share.onShare}
            >
              <Trans i18nKey="dashboard.insights.answer.share">Share with viewers</Trans>
            </Button>
          )}
          {investigate && !investigate.unavailable && canStartInvestigation(investigate.investigation) && (
            <Button
              size="sm"
              variant="secondary"
              fill="text"
              icon="search"
              tooltip={t(
                'dashboard.insights.answer.investigate-tooltip',
                'Start an Assistant investigation that checks these findings against your data sources and looks for the cause'
              )}
              onClick={investigate.onInvestigate}
            >
              {investigate.investigation
                ? t('dashboard.insights.answer.investigate-again', 'Investigate again')
                : t('dashboard.insights.answer.investigate', 'Investigate')}
            </Button>
          )}
        </Stack>
        {/* Keyed so a new answer can be rated again. */}
        <InsightFeedback key={result.completedAt} result={result} />
      </div>
      {share?.error && (
        <Text element="p" variant="bodySmall" color="error">
          {share.error}
        </Text>
      )}
      {investigate?.investigation && <InsightInvestigationView investigation={investigate.investigation} />}
    </Stack>
  );
}

interface EvidenceProps {
  evidence: InsightEvidence;
  snapshot: InsightResult['snapshot'];
  sources: InsightSourcePanel[];
}

/** Lets the viewer check a finding: go to the panel it is based on, or open the window it cites in Explore. */
function InsightEvidenceLinks({ evidence, snapshot, sources }: EvidenceProps) {
  const styles = useStyles2(getStyles);
  const source = sources.find((candidate) => candidate.key === evidence.panel);
  const title = snapshot.panels.find((panel) => panel.key === evidence.panel)?.title ?? evidence.panel;
  const { from, to } = evidence;

  if (!source) {
    return (
      <Text variant="bodySmall" color="secondary">
        {t('dashboard.insights.sources.unavailable', '{{title}} (unavailable)', { title })}
      </Text>
    );
  }

  const openInExplore = async () => {
    if (!from || !to) {
      return;
    }
    const url = await getInsightExploreUrl(source.panel, { from, to });
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={styles.evidence}>
      <Button
        size="sm"
        variant="secondary"
        fill="text"
        icon="crosshair"
        tooltip={t('dashboard.insights.answer.evidence-go-to', 'Go to the panel this is based on')}
        onClick={() => revealInsightSourcePanel(source.panel)}
      >
        {from && to
          ? t('dashboard.insights.answer.evidence-window', '{{title}} · {{from}} – {{to}}', {
              title,
              from: dateTimeFormat(from, { format: WINDOW_FORMAT }),
              to: dateTimeFormat(to, { format: WINDOW_FORMAT }),
            })
          : title}
      </Button>
      {from && to && (
        <IconButton
          name="compass"
          size="sm"
          tooltip={t('dashboard.insights.answer.evidence-explore', 'Open this window in Explore')}
          onClick={openInExplore}
        />
      )}
    </div>
  );
}

type Rating = 'helpful' | 'not_helpful';

/** Sent to interaction analytics with the question and the answer, so answer quality can be reviewed. */
function InsightFeedback({ result }: { result: InsightResult }) {
  const [rating, setRating] = useState<Rating>();

  const rate = (value: Rating) => {
    setRating(value);
    reportInteraction('dashboards_insights_answer_feedback', {
      rating: value,
      question: result.snapshot.question,
      answer: JSON.stringify(result.content),
      sourcePanels: result.snapshot.panels.length,
      comparedWithPreviousPeriod: Boolean(result.snapshot.previousPeriod),
      breakdownVariable: result.snapshot.breakdown?.variable,
      shared: Boolean(result.share),
    });
  };

  if (rating) {
    return (
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="dashboard.insights.answer.feedback-thanks">Thanks for the feedback</Trans>
      </Text>
    );
  }

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      <IconButton
        name="thumbs-up"
        size="sm"
        tooltip={t('dashboard.insights.answer.feedback-helpful', 'Helpful answer')}
        onClick={() => rate('helpful')}
      />
      <IconButton
        name="thumbs-down"
        size="sm"
        tooltip={t('dashboard.insights.answer.feedback-not-helpful', 'Unhelpful answer')}
        onClick={() => rate('not_helpful')}
      />
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    findings: css({
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      paddingLeft: theme.spacing(1.5),
      borderLeft: `2px solid ${theme.colors.border.medium}`,
    }),
    breakdown: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    breakdownList: css({
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.25),
    }),
    evidence: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      marginLeft: theme.spacing(-1),
    }),
    caveat: css({
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
    }),
    details: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    summary: css({
      cursor: 'pointer',
    }),
    detailsBody: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      paddingTop: theme.spacing(1),
    }),
    actions: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
    }),
  };
}
