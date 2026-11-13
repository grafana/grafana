import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, type BadgeColor, Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { type Hint, type HintSeverity, HINTS, TREND_MAX } from '../mockScenario';

import { AssistantIcon } from './AssistantIcon';
import { TrendSparkline, type TrendColor } from './TrendSparkline';

interface Props {
  // Defaults to every detected hint. Once one is being investigated, the page passes just that one,
  // so the row the user clicked stays in view on the next step.
  hints?: Hint[];
  // Without it the rows have no action, because the investigation has already started.
  onInvestigate?: (hint: Hint) => void;
}

export function DrilldownHints({ hints = HINTS, onInvestigate }: Props) {
  const styles = useStyles2(getStyles);
  const severities = getSeverities();

  return (
    <section className={styles.hints} aria-labelledby="drilldown-hints-title">
      <Stack gap={1} alignItems="center" wrap="wrap">
        <AssistantIcon />
        <Text element="h2" variant="body" weight="medium" id="drilldown-hints-title">
          {t('drilldown-page.hints.title', 'Detected in the last 30 minutes')}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {t('drilldown-page.hints.sources', 'From alerts, SLOs, anomaly detection and deploy events')}
        </Text>
      </Stack>
      {hints.length === 0 && (
        <div className={styles.empty}>
          <Text color="secondary">
            {t('drilldown-page.hints.empty', 'All quiet: no regressions in the last 30 minutes.')}
          </Text>
        </div>
      )}
      <ul className={styles.list}>
        {hints.map((hint) => {
          const severity = severities[hint.severity];
          return (
            <li key={hint.id} className={styles.hint}>
              <div className={styles.badge}>
                <Badge color={severity.badge} text={severity.label} />
              </div>
              <Stack direction="column" gap={0.25}>
                <Text weight="medium">{hint.title}</Text>
                <Text variant="bodySmall" color="secondary">
                  {hint.description}
                </Text>
              </Stack>
              <div className={styles.trend}>
                <Text variant="bodySmall" color="secondary">
                  {hint.trendLabel}
                </Text>
                <TrendSparkline values={hint.trend} color={severity.trend} height={28} max={TREND_MAX} />
              </div>
              <div className={styles.action}>
                {onInvestigate &&
                  (hint.investigable ? (
                    <Button size="sm" variant="primary" onClick={() => onInvestigate(hint)}>
                      {t('drilldown-page.hints.investigate', 'Investigate')}
                    </Button>
                  ) : (
                    <Text variant="bodySmall" color="secondary">
                      {t('drilldown-page.hints.no-action', 'No action needed')}
                    </Text>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function getSeverities(): Record<HintSeverity, { badge: BadgeColor; trend: TrendColor; label: string }> {
  return {
    slow: { badge: 'red', trend: 'red', label: t('drilldown-page.hints.severity-slow', 'Slow') },
    errors: { badge: 'orange', trend: 'orange', label: t('drilldown-page.hints.severity-errors', 'Errors') },
    deploy: { badge: 'blue', trend: 'green', label: t('drilldown-page.hints.severity-deploy', 'Deploy') },
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  hints: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  list: css({
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: 0,
    padding: 0,
  }),
  hint: css({
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr) 200px 132px',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '72px minmax(0, 1fr)',
    },
  }),
  badge: css({
    display: 'flex',
  }),
  empty: css({
    padding: theme.spacing(2),
    border: `1px dashed ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  trend: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  action: css({
    display: 'flex',
    justifyContent: 'flex-end',
  }),
});
