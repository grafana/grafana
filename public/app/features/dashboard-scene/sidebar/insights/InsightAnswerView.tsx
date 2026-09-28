import { css } from '@emotion/css';

import { dateTimeFormat, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { InsightSourceLinks } from './InsightSourceLinks';
import { type InsightSourcePanel } from './sources';
import { type InsightResult } from './types';

const UTC_FORMAT = 'YYYY-MM-DD HH:mm:ss';

interface Props {
  result: InsightResult;
  sources: InsightSourcePanel[];
  onFollowUp: () => void;
}

export function InsightAnswerView({ result, sources, onFollowUp }: Props) {
  const styles = useStyles2(getStyles);
  const { content, snapshot } = result;

  return (
    <Stack direction="column" gap={1.5}>
      <Text element="p" weight="medium">
        {content.headline}
      </Text>
      <ul className={styles.findings}>
        {content.findings.map((finding, index) => (
          <li key={index}>
            <Text weight="medium">{finding.label}</Text>
            <Text element="p" color="secondary">
              {finding.detail}
            </Text>
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
          <InsightSourceLinks items={snapshot.panels} sources={sources} />
        </div>
      </details>
      <div>
        <Button size="sm" variant="secondary" fill="text" icon="comment-alt-message" onClick={onFollowUp}>
          <Trans i18nKey="dashboard.insights.answer.follow-up">Ask a follow-up</Trans>
        </Button>
      </div>
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
  };
}
