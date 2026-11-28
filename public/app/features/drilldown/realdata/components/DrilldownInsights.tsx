import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LinkButton, PanelChrome, Stack, Text, useStyles2 } from '@grafana/ui';

import { type AppKey, INSIGHTS, type InsightSummary } from '../liveScenario';

import { TrendSparkline } from './TrendSparkline';

interface Props {
  appUrls: Partial<Record<AppKey, string>>;
}

export function DrilldownInsights({ appUrls }: Props) {
  const styles = useStyles2(getStyles);
  const appNames = getAppNames();

  return (
    <section>
      <Text element="h2" variant="h3">
        {t('drilldown-real.insights.title', 'Insights')}
      </Text>
      <div className={styles.strip}>
        {INSIGHTS.map((insight) => (
          <InsightCard key={insight.app} insight={insight} appName={appNames[insight.app]} url={appUrls[insight.app]} />
        ))}
      </div>
    </section>
  );
}

function InsightCard({ insight, appName, url }: { insight: InsightSummary; appName: string; url?: string }) {
  const styles = useStyles2(getStyles);

  // The Open button is the card's only link and stretches over the whole card, so the card stays selectable.
  const openButton = url && (
    <LinkButton
      href={url}
      size="sm"
      variant="secondary"
      className={styles.openButton}
      aria-label={t('drilldown-real.insights.open-signal', 'Open {{app}}: {{label}} {{value}}', {
        app: appName,
        label: insight.label,
        value: insight.value,
      })}
    >
      {t('drilldown-real.insights.open', 'Open')}
    </LinkButton>
  );

  return (
    <div className={url ? styles.card : undefined}>
      <PanelChrome title={appName} actions={openButton}>
        <Stack direction="column" gap={1}>
          <Text variant="bodySmall" color="secondary">
            {insight.label}
          </Text>
          <Text element="p" variant="h4">
            {insight.value}
          </Text>
          <span className={insight.tone === 'neutral' ? styles.changeNeutral : styles.change}>{insight.change}</span>
          {insight.trend.length > 1 && <TrendSparkline values={insight.trend} />}
        </Stack>
      </PanelChrome>
    </div>
  );
}

export function getAppNames(): Record<AppKey, string> {
  return {
    metrics: t('drilldown-real.apps.metrics', 'Metrics'),
    logs: t('drilldown-real.apps.logs', 'Logs'),
    traces: t('drilldown-real.apps.traces', 'Traces'),
    profiles: t('drilldown-real.apps.profiles', 'Profiles'),
    sql: t('drilldown-real.apps.sql', 'SQL'),
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  strip: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    marginTop: theme.spacing(1.5),
  }),
  card: css({
    borderRadius: theme.shape.radius.lg,
    '&:hover': {
      outline: `1px solid ${theme.colors.border.strong}`,
    },
  }),
  openButton: css({
    position: 'static',
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
    },
  }),
  change: css({
    color: theme.colors.error.text,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  changeNeutral: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
