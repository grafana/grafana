import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Button, Spinner, Tooltip, useStyles2 } from '@grafana/ui';

/**
 * Discriminated union for compatibility check states.
 * Each state variant only includes fields relevant to that state,
 * making invalid states unrepresentable at the type level.
 */
export type CompatibilityState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; score: number; metricsFound: number; metricsTotal: number }
  | { status: 'error'; errorMessage?: string };

interface CompatibilityBadgeProps {
  state: CompatibilityState;
  onCheck: () => void; // Called when Check button clicked
  onRetry?: () => void; // Called when error badge clicked
}

/**
 * Determines the color category based on compatibility score.
 * - green: ≥80% (highly compatible)
 * - orange: 50-79% (partially compatible)
 * - red: <50% (low compatibility)
 */
function getScoreColor(score: number): 'green' | 'orange' | 'red' {
  if (score >= 80) {
    return 'green';
  }
  if (score >= 50) {
    return 'orange';
  }
  return 'red';
}

/**
 * Returns the appropriate icon name based on compatibility score.
 */
function getScoreIcon(score: number): 'check-circle' | 'exclamation-triangle' | 'times-circle' {
  if (score >= 80) {
    return 'check-circle';
  }
  if (score >= 50) {
    return 'exclamation-triangle';
  }
  return 'times-circle';
}

/**
 * Returns the appropriate tooltip message based on compatibility score.
 * - Green (≥80%): Simple match message
 * - Orange (50-79%): Match message + warning about panel customization
 * - Red (<50%): Match message + warning about query customization
 */
function getScoreTooltip(score: number, metricsFound: number, metricsTotal: number): string {
  if (score >= 80) {
    return t(
      'dashboard-library.compatibility-badge.tooltip-green',
      '{{score}}% ({{found}}/{{total}}) of metrics match.',
      { score, found: metricsFound, total: metricsTotal }
    );
  }

  if (score >= 50) {
    return t(
      'dashboard-library.compatibility-badge.tooltip-orange',
      '{{score}}% ({{found}}/{{total}}) of metrics match. This dashboard may contain panels that require heavy customization.',
      { score, found: metricsFound, total: metricsTotal }
    );
  }

  return t(
    'dashboard-library.compatibility-badge.tooltip-red',
    '{{score}}% ({{found}}/{{total}}) of metrics match. This dashboard will require heavy query customization.',
    { score, found: metricsFound, total: metricsTotal }
  );
}

/**
 * Compact inline badge that displays dashboard compatibility status.
 *
 * States:
 * - idle: Shows "Check" button to trigger compatibility check
 * - loading: Shows "Check" button disabled with spinner (Grafana pattern)
 * - success: Shows score with color coding (green ≥80%, orange 50-79%, red <50%)
 * - error: Shows error badge with retry option
 */
export const CompatibilityBadge = ({ state, onCheck, onRetry }: CompatibilityBadgeProps) => {
  const styles = useStyles2(getStyles);
  const isLoading = state.status === 'loading';

  // Idle/Loading state - show Check button (changes to "Checking" with spinner when loading)
  if (state.status === 'idle' || state.status === 'loading') {
    const buttonText = isLoading
      ? t('dashboard-library.compatibility-badge.checking', 'Checking')
      : t('dashboard-library.compatibility-badge.check', 'Check compatibility');

    const tooltipContent = t(
      'dashboard-library.compatibility-badge.check-tooltip',
      'Checks how many dashboard metrics match your data source.'
    );

    return (
      <Tooltip interactive={true} content={tooltipContent}>
        <Button
          variant="secondary"
          fill="outline"
          disabled={isLoading}
          onClick={(e) => {
            e.stopPropagation();
            onCheck();
          }}
          aria-label={buttonText}
          data-testid={isLoading ? 'compatibility-badge-loading' : undefined}
          className={styles.button}
          icon="info-circle"
        >
          {buttonText}
          {isLoading && <Spinner size="xs" inline className={styles.spinner} />}
        </Button>
      </Tooltip>
    );
  }

  // Error state - show error badge with retry
  if (state.status === 'error') {
    const errorPrefix = state.errorMessage || t('dashboard-library.compatibility-badge.check-failed', 'Check failed');
    const errorSuffix = t(
      'dashboard-library.compatibility-badge.error-hint',
      'There is an error with the compatibility check, your data source and variables may need to be reviewed.'
    );
    const errorTooltip = `${errorPrefix}. ${errorSuffix}`;
    return (
      <Tooltip interactive={true} content={errorTooltip}>
        <span
          className={styles.badgeWrapper}
          onClick={(e) => {
            e.stopPropagation();
            onRetry?.();
          }}
          data-testid="compatibility-badge-error"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onRetry?.();
            }
          }}
        >
          <Badge
            text={t('dashboard-library.compatibility-badge.error-text', 'Error')}
            icon="exclamation-circle"
            color="red"
            className={styles.clickableBadge}
          />
        </span>
      </Tooltip>
    );
  }

  // Success state - show score with color coding
  // With discriminated unions, TypeScript knows score/metricsFound/metricsTotal exist
  if (state.status === 'success') {
    const color = getScoreColor(state.score);
    const icon = getScoreIcon(state.score);
    const tooltipContent = getScoreTooltip(state.score, state.metricsFound, state.metricsTotal);

    return (
      <Tooltip interactive={true} content={tooltipContent}>
        <span className={styles.badgeWrapper} data-testid="compatibility-badge-success">
          <Badge
            text={t('dashboard-library.compatibility-badge.score-text', '{{score}}% compatible', {
              score: state.score,
            })}
            icon={icon}
            color={color}
            className={styles.badge}
          />
        </span>
      </Tooltip>
    );
  }

  // Fallback - shouldn't reach here but return null if state is malformed
  return null;
};

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      // Min-width prevents layout shift between "Check" and "Checking" states
      minWidth: theme.spacing(12),
      justifyContent: 'center',
    }),
    spinner: css({
      marginLeft: theme.spacing(1),
    }),
    badgeWrapper: css({
      display: 'inline-flex',
      alignItems: 'center',
    }),
    // Match button height (md = 32px) with vertical padding
    // Badge default is ~22px, button md is 32px, so add ~6.4px padding each side
    // theme.spacing(0.8) = 6.4px (close to 6.38px)
    badge: css({
      paddingTop: theme.spacing(0.8),
      paddingBottom: theme.spacing(0.8),
    }),
    clickableBadge: css({
      paddingTop: theme.spacing(0.8),
      paddingBottom: theme.spacing(0.8),
      cursor: 'pointer',
      '&:hover': {
        opacity: 0.8,
      },
    }),
  };
}
