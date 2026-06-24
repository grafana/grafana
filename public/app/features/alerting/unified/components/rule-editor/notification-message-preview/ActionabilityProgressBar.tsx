import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { actionabilitySeverity, type ActionabilityScore } from './computeActionabilityScore';

interface ActionabilityProgressBarProps {
  actionability: ActionabilityScore;
}

export function ActionabilityProgressBar({ actionability }: ActionabilityProgressBarProps) {
  const styles = useStyles2(getStyles);
  const severity = actionabilitySeverity(actionability.score);
  const scoreLabel = t('alerting.notification-message-preview.actionability-score-value', '{{score}}%', {
    score: actionability.score,
  });
  const scoreAriaLabel = t('alerting.notification-message-preview.actionability-score', 'Actionability: {{score}}%', {
    score: actionability.score,
  });

  return (
    <Stack direction="column" gap={0.75} data-testid="actionability-progress">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Text variant="bodySmall" color="primary">
          <Trans i18nKey="alerting.notification-message-preview.actionability-label">Actionability</Trans>
        </Text>
        <span className={styles.scorePill(severity)} aria-label={scoreAriaLabel}>
          {scoreLabel}
        </span>
      </Stack>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={actionability.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={scoreAriaLabel}
      >
        <div className={styles.fill({ severity, score: actionability.score })} />
      </div>
      {actionability.missing.length > 0 ? (
        <Text variant="bodySmall" color="secondary">
          {t('alerting.notification-message-preview.missing-hints', 'Still missing: {{items}}', {
            items: actionability.missing.join(', '),
          })}
        </Text>
      ) : (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.notification-message-preview.actionability-complete">
            This alert has enough context for on-call to act quickly.
          </Trans>
        </Text>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  track: css({
    height: theme.spacing(0.75),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.secondary,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  scorePill: (severity: 'error' | 'warning' | 'success') =>
    css({
      display: 'inline-block',
      background: theme.colors[severity].main,
      color: theme.colors[severity].contrastText,
      borderRadius: theme.shape.radius.pill,
      padding: `${theme.spacing(0.25)} ${theme.spacing(0.75)}`,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
    }),
  fill: ({ severity, score }: { severity: 'error' | 'warning' | 'success'; score: number }) =>
    css({
      height: '100%',
      width: `${Math.min(Math.max(score, 0), 100)}%`,
      borderRadius: theme.shape.radius.pill,
      transition: 'width 200ms ease-out',
      background:
        severity === 'success'
          ? theme.colors.success.main
          : severity === 'warning'
            ? theme.colors.warning.main
            : theme.colors.error.main,
    }),
});
