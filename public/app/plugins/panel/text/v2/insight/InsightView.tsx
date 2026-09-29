import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Icon, ScrollContainer, Spinner, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { type DashboardSceneLike } from 'app/features/dashboard-scene/scene/types/dashboard';
import { InsightAnswerView } from 'app/features/dashboard-scene/sidebar/insights/InsightAnswerView';
import { openInsightFollowUp } from 'app/features/dashboard-scene/sidebar/insights/followUp';

import { type InsightOptions } from '../../panelcfg.gen';

import { InsightFollowUps } from './InsightFollowUps';
import { useInsight } from './useInsight';

export interface InsightViewProps {
  dashboard: DashboardSceneLike | undefined;
  options: InsightOptions;
  fitContent?: boolean;
  /**
   * The mode picker, while editing. Insight mode has no editor of its own, so without this
   * there is no way back to Markdown, HTML, or Code.
   */
  modePicker?: ReactNode;
}

export function InsightView({ dashboard, options, fitContent, modePicker }: InsightViewProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const insight = useInsight(dashboard, options);
  const { result, running, loadingSources, error, staleReasons, unavailable, sources } = insight;

  const question = (options.question ?? '').trim();
  const hasSources = (options.sourcePanelKeys ?? []).length > 0;
  const stale = staleReasons.length > 0;
  // A refusal blocks asking; an unloaded source does not, since asking loads it first.
  const canAsk = Boolean(dashboard) && question !== '' && hasSources && !running && !unavailable;

  const isUnconfigured = question === '' || !hasSources;

  const askLabel = result
    ? t('textng.insight.ask-again', 'Ask Assistant again')
    : t('textng.insight.ask', 'Ask Assistant');

  const emptyBody = (
    <div className={styles.empty}>
      <Stack direction="column" alignItems="center" gap={1}>
        <Icon name="ai-sparkle" size="xl" className={styles.emptyIcon} />
        <Text element="p" textAlignment="center" color="secondary">
          {question === '' ? (
            <Trans i18nKey="textng.insight.empty-question">
              Set an insight question in the panel options to ask Assistant about your data.
            </Trans>
          ) : (
            <Trans i18nKey="textng.insight.empty-sources">
              Select the source panels Assistant may use in the panel options.
            </Trans>
          )}
        </Text>
      </Stack>
    </div>
  );

  const answerBody = (
    <Stack direction="column" gap={1.5}>
      <div className={styles.header}>
        <Stack direction="row" gap={1} alignItems="start">
          <Icon name="ai-sparkle" size="md" className={styles.questionIcon} />
          <Text element="h3" variant="body" weight="medium">
            {question}
          </Text>
        </Stack>
        {!stale && (
          <Button size="sm" variant="secondary" disabled={!canAsk} onClick={insight.ask}>
            {askLabel}
          </Button>
        )}
      </div>

      {stale && (
        <Alert
          severity="warning"
          title={t('textng.insight.stale-title', 'Out of date')}
          bottomSpacing={0}
          action={
            <Button size="sm" variant="secondary" disabled={!canAsk} onClick={insight.ask}>
              {askLabel}
            </Button>
          }
        >
          {staleReasons.join(' · ')}
        </Alert>
      )}

      {running && (
        <Stack direction="row" gap={1} alignItems="center">
          <Spinner size="sm" inline />
          <Text variant="bodySmall" color="secondary">
            {loadingSources ? (
              <Trans i18nKey="textng.insight.loading-sources">Loading source panels…</Trans>
            ) : (
              <Trans i18nKey="textng.insight.running">Analyzing selected panels…</Trans>
            )}
          </Text>
        </Stack>
      )}

      {unavailable && !running && (
        <Alert severity="info" title={unavailable} bottomSpacing={0} data-testid="TextNGPanel-insight-unavailable" />
      )}

      {error && (
        <Alert
          severity="error"
          title={t('textng.insight.error-title', 'Assistant could not answer')}
          bottomSpacing={0}
          data-testid="TextNGPanel-insight-error"
        >
          {error}
        </Alert>
      )}

      {result ? (
        <>
          <InsightAnswerView result={result} sources={sources} onFollowUp={() => openInsightFollowUp(result, stale)} />
          <InsightFollowUps
            threads={insight.followUps}
            sources={sources}
            disabled={running}
            onAsk={insight.askFollowUp}
          />
        </>
      ) : (
        !running &&
        !unavailable && (
          <Text element="p" variant="bodySmall" color="secondary">
            <Trans i18nKey="textng.insight.hint">
              Get a takeaway and supporting findings from the source panels. Answers stay in this session.
            </Trans>
          </Text>
        )
      )}
    </Stack>
  );

  const body = isUnconfigured ? emptyBody : answerBody;

  // Fit-content: normal flow, so the answer defines the panel height and the cell bounds it.
  const content = fitContent ? (
    <div className={styles.fit}>{body}</div>
  ) : (
    <ScrollContainer minHeight="100%">
      <div className={styles.padded}>{body}</div>
    </ScrollContainer>
  );

  if (!modePicker) {
    return content;
  }

  // Matches the content editor's layout: a toolbar row, then a body that takes the rest.
  return (
    <Stack direction="column" gap={1} height="100%">
      <Stack gap={1} alignItems="center" minHeight={theme.components.height.md}>
        {modePicker}
      </Stack>
      <Stack direction="column" grow={1} minHeight={0}>
        {content}
      </Stack>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    header: css({
      display: 'flex',
      alignItems: 'start',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
    }),
    questionIcon: css({
      color: theme.colors.text.link,
      flexShrink: 0,
      marginTop: theme.spacing(0.25),
    }),
    padded: css({
      padding: theme.spacing(0.5),
    }),
    fit: css({
      padding: theme.spacing(0.5),
      height: 'auto',
    }),
    empty: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: theme.spacing(2),
    }),
    emptyIcon: css({
      color: theme.colors.text.secondary,
    }),
  };
}
