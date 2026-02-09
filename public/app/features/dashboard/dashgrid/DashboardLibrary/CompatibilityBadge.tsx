import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
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
  | { status: 'error'; errorMessage?: string; errorCode?: string };

export type ErrorCategory = 'not_supported' | 'unexpected';

interface ScoreIndicator {
  color: 'green' | 'orange' | 'red';
  icon: 'check-circle' | 'exclamation-triangle' | 'times-circle';
  tooltip: string;
}

interface CompatibilityBadgeProps {
  state: CompatibilityState;
  onCheck: () => void;
  onRetry?: () => void;
}

const NOT_SUPPORTED_CODES = ['datasource_wrong_type', 'unsupported_dashboard_version', 'invalid_dashboard'];

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

  if (state.status === 'error') {
    const tooltipContent = getErrorTooltip(state.errorCode, styles.tooltipLink);

    return (
      <Tooltip interactive={true} content={tooltipContent}>
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

  if (state.status === 'success') {
    const {
      color,
      icon,
      tooltip: tooltipContent,
    } = getScoreIndicator(state.score, state.metricsFound, state.metricsTotal);

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

  return null;
};

function categorizeError(errorCode?: string): ErrorCategory {
  if (errorCode && NOT_SUPPORTED_CODES.includes(errorCode)) {
    return 'not_supported';
  }
  return 'unexpected';
}

/**
 * Returns color, icon, and tooltip for a compatibility score.
 * Thresholds: green ≥80%, orange 50-79%, red <50%.
 */
function getScoreIndicator(score: number, metricsFound: number, metricsTotal: number): ScoreIndicator {
  if (score >= 80) {
    return {
      color: 'green',
      icon: 'check-circle',
      tooltip: t(
        'dashboard-library.compatibility-badge.tooltip-green',
        '{{score}}% ({{found}}/{{total}}) of metrics match.',
        { score, found: metricsFound, total: metricsTotal }
      ),
    };
  }

  if (score >= 50) {
    return {
      color: 'orange',
      icon: 'exclamation-triangle',
      tooltip: t(
        'dashboard-library.compatibility-badge.tooltip-orange',
        '{{score}}% ({{found}}/{{total}}) of metrics match. This dashboard may contain panels that require heavy customization.',
        { score, found: metricsFound, total: metricsTotal }
      ),
    };
  }

  return {
    color: 'red',
    icon: 'times-circle',
    tooltip: t(
      'dashboard-library.compatibility-badge.tooltip-red',
      '{{score}}% ({{found}}/{{total}}) of metrics match. This dashboard will require heavy query customization.',
      { score, found: metricsFound, total: metricsTotal }
    ),
  };
}

function getErrorTooltip(errorCode: string | undefined, linkClassName: string) {
  const category = categorizeError(errorCode);
  if (category === 'not_supported') {
    return (
      <Trans i18nKey="dashboard-library.compatibility-badge.not-supported-tooltip">
        This dashboard or datasource type is not yet supported. Only Prometheus datasources and non-dynamic dashboards
        (v1) are currently supported.
      </Trans>
    );
  }

  return (
    <Trans i18nKey="dashboard-library.compatibility-badge.error-tooltip">
      Compatibility check failed. First, verify the{' '}
      <a
        href="https://grafana.com/docs/grafana/latest/datasources/"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        data source
      </a>{' '}
      is working. Then open the dashboard and review the{' '}
      <a
        href="https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/modify-dashboard-settings/"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        variables
      </a>
      .
    </Trans>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
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
    tooltipLink: css({
      color: theme.colors.text.link,
      textDecoration: 'underline',
      '&:hover': {
        textDecoration: 'none',
      },
    }),
  };
}
