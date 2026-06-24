import { css } from '@emotion/css';
import { type CSSProperties } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { actionabilitySeverity, type ActionabilityScore } from './computeActionabilityScore';

/** Hardcoded severity colors — theme tokens can match parent background in some themes. */
const SCORE_COLORS = {
  error: '#FF5286',
  warning: '#FFB357',
  success: '#73BF69',
} as const;

const ACTIONABILITY_SCORE_CLASS = 'grafana-alerting-actionability-score-value';
const ACTIONABILITY_SCORE_STYLE_ID = 'grafana-alerting-actionability-score-styles';

function ensureActionabilityScoreStyles() {
  if (typeof document === 'undefined' || document.getElementById(ACTIONABILITY_SCORE_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = ACTIONABILITY_SCORE_STYLE_ID;
  style.textContent = `
    .${ACTIONABILITY_SCORE_CLASS} {
      color: var(--grafana-alerting-actionability-score-color, #FF5286) !important;
      font-size: 20px !important;
      font-weight: 700 !important;
    }
  `;
  document.head.appendChild(style);
}

interface ActionabilityProgressBarProps {
  actionability: ActionabilityScore;
}

export function ActionabilityProgressBar({ actionability }: ActionabilityProgressBarProps) {
  ensureActionabilityScoreStyles();

  const styles = useStyles2(getStyles);
  const severity = actionabilitySeverity(actionability.score);
  const scoreColor = SCORE_COLORS[severity];
  const fillPercent = Math.min(Math.max(actionability.score, 0), 100);
  const showMinimumFill = fillPercent === 0;
  const scoreLabel = t('alerting.notification-message-preview.actionability-score-value', '{{score}}%', {
    score: actionability.score,
  });
  const scoreAriaLabel = t('alerting.notification-message-preview.actionability-score', 'Actionability: {{score}}%', {
    score: actionability.score,
  });
  const scoreStyle: CSSProperties = {
    color: scoreColor,
    fontSize: 20,
    fontWeight: 700,
    display: 'block',
    lineHeight: 1.2,
    ['--grafana-alerting-actionability-score-color' as string]: scoreColor,
  };

  return (
    <Stack direction="column" gap={0.75} data-testid="actionability-progress">
      <div className={styles.headerRow}>
        <Text variant="bodySmall" color="primary">
          <Trans i18nKey="alerting.notification-message-preview.actionability-label">Actionability</Trans>
        </Text>
        <span
          className={ACTIONABILITY_SCORE_CLASS}
          data-testid="actionability-score-value"
          aria-label={scoreAriaLabel}
          style={scoreStyle}
        >
          {scoreLabel}
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={actionability.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={scoreAriaLabel}
      >
        <div
          className={styles.fill}
          style={{
            width: showMinimumFill ? undefined : `${fillPercent}%`,
            minWidth: showMinimumFill ? 6 : undefined,
            backgroundColor: scoreColor,
          }}
        />
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
  headerRow: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  }),
  track: css({
    height: theme.spacing(0.75),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.secondary,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  fill: css({
    height: '100%',
    borderRadius: theme.shape.radius.pill,
    transition: 'width 200ms ease-out',
  }),
});
