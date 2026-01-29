import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Button, Spinner, Tooltip, useStyles2 } from '@grafana/ui';

export type CompatibilityStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CompatibilityState {
  status: CompatibilityStatus;
  score?: number; // 0-100 percentage
  metricsFound?: number; // Count of found metrics
  metricsTotal?: number; // Total metrics in dashboard
  errorMessage?: string; // For error state
}

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
      : t('dashboard-library.compatibility-badge.check', 'Check');

    return (
      <Button
        variant="secondary"
        disabled={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          onCheck();
        }}
        aria-label={buttonText}
        data-testid={isLoading ? 'compatibility-badge-loading' : undefined}
        className={styles.button}
      >
        {buttonText}
        {isLoading && <Spinner size="xs" inline className={styles.spinner} />}
      </Button>
    );
  }

  // Error state - show error badge with retry
  if (state.status === 'error') {
    const errorTooltip =
      state.errorMessage || t('dashboard-library.compatibility-badge.check-failed', 'Check failed · Click to retry');
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
          <Badge text="" icon="exclamation-circle" color="red" className={styles.clickableBadge} />
        </span>
      </Tooltip>
    );
  }

  // Success state - show score with color coding
  if (state.status === 'success' && state.score !== undefined) {
    const color = getScoreColor(state.score);
    const icon = getScoreIcon(state.score);
    const tooltipContent =
      state.metricsFound !== undefined && state.metricsTotal !== undefined
        ? t(
            'dashboard-library.compatibility-badge.score-tooltip',
            '{{score}}% metric availability · {{found}}/{{total}} metrics exist in your datasource',
            {
              score: state.score,
              found: state.metricsFound,
              total: state.metricsTotal,
            }
          )
        : t('dashboard-library.compatibility-badge.score-only-tooltip', '{{score}}% metric availability', {
            score: state.score,
          });

    return (
      <Tooltip interactive={true} content={tooltipContent}>
        <span className={styles.badgeWrapper} data-testid="compatibility-badge-success">
          <Badge
            text={t('dashboard-library.compatibility-badge.score-text', '{{score}}%', { score: state.score })}
            icon={icon}
            color={color}
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
    clickableBadge: css({
      cursor: 'pointer',
      '&:hover': {
        opacity: 0.8,
      },
    }),
  };
}
