import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { Badge, type BadgeColor, Button, Link, Pagination, Stack, Text, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { assistantContext } from '../assistantContext';
import { type Hint, type HintEvidence, type HintSeverity, HINTS, NOTES, TREND_MAX } from '../liveScenario';
import { getHintDrilldownQuery } from '../loadScenario';

import { AssistantIcon } from './AssistantIcon';
import { getAppNames } from './DrilldownInsights';
import { TrendSparkline, type TrendColor } from './TrendSparkline';

interface Props {
  hints?: Hint[];
}

const PAGE_SIZE = 3;

const SIGNAL_APPS = {
  metrics: { type: 'prometheus', pluginId: 'grafana-metricsdrilldown-app' },
  logs: { type: 'loki', pluginId: 'grafana-lokiexplore-app' },
  traces: { type: 'tempo', pluginId: 'grafana-exploretraces-app' },
};

export function DrilldownHints({ hints = HINTS }: Props) {
  const styles = useStyles2(getStyles);
  const severities = getSeverities();
  const appNames = getAppNames();
  const { isAvailable, openAssistant } = useAssistant();
  const [page, setPage] = useState(1);

  if (!isAvailable) {
    return null;
  }

  const numberOfPages = Math.ceil(hints.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(1, numberOfPages));
  const visibleHints = hints.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const onInvestigate = (hint: Hint) =>
    openAssistant?.({
      origin: 'grafana/drilldown-home',
      prompt: t(
        'drilldown-real.hints.explain-and-drilldown-prompt',
        'Explain this finding: {{finding}}. Use the attached evidence and time range to summarize the likely impact, then recommend where to investigate further: Logs Drilldown for error messages and patterns, Traces Drilldown for failing or slow requests, or Metrics Drilldown for rates and trends. Prefer the supporting signals in the attached evidence; include other selected signals only when your investigation finds relevant evidence. Finish with a relevant Drilldown action.',
        { finding: hint.title }
      ),
      context: assistantContext(hint.scope, hint),
      autoSend: true,
    });

  return (
    <section className={styles.hints} aria-labelledby="drilldown-hints-title">
      <Stack gap={1} alignItems="center" justifyContent="space-between" wrap="wrap">
        <Stack gap={1} alignItems="center" wrap="wrap">
          <AssistantIcon />
          <Text element="h2" variant="body" weight="medium" id="drilldown-hints-title">
            {t('drilldown-real.hints.title', 'Detected in the last 30 minutes')}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {t('drilldown-real.hints.telemetry-sources', 'From your selected logs, metrics and traces')}
          </Text>
        </Stack>
        <Pagination
          className={styles.pagination}
          currentPage={currentPage}
          numberOfPages={numberOfPages}
          onNavigate={setPage}
          hideWhenSinglePage
        />
      </Stack>
      {hints.length === 0 && (
        <div className={styles.empty}>
          <Text color="secondary">
            {NOTES.length === 0
              ? t(
                  'drilldown-real.hints.no-detections',
                  'No errors or latency changes detected in the selected data sources.'
                )
              : t(
                  'drilldown-real.hints.empty-partial',
                  'Nothing detected by the data sources that could be measured. Some were not measured, see the notice above.'
                )}
          </Text>
        </div>
      )}
      <ul className={styles.list}>
        {visibleHints.map((hint) => {
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
                <Stack gap={0.5} wrap="wrap">
                  {[...new Map(hint.evidence.map((item) => [item.signal, item])).values()].map((evidence) => (
                    <BuildSignalLink
                      key={evidence.signal}
                      hint={hint}
                      evidence={evidence}
                      name={appNames[evidence.signal]}
                    />
                  ))}
                </Stack>
              </Stack>
              <div className={styles.trend}>
                {hint.trend.length > 1 && (
                  <>
                    <Text variant="bodySmall" color="secondary">
                      {hint.trendLabel}
                    </Text>
                    <TrendSparkline values={hint.trend} color={severity.trend} height={28} max={TREND_MAX} />
                  </>
                )}
              </div>
              <div className={styles.action}>
                {hint.investigable ? (
                  <Button size="sm" variant="primary" onClick={() => onInvestigate(hint)}>
                    {t('drilldown-real.hints.investigate', 'Investigate')}
                  </Button>
                ) : (
                  <Text variant="bodySmall" color="secondary">
                    {t('drilldown-real.hints.no-action', 'No action needed')}
                  </Text>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BuildSignalLink({ hint, evidence, name }: { hint: Hint; evidence: HintEvidence; name: string }) {
  const styles = useStyles2(getStyles);
  const app = SIGNAL_APPS[evidence.signal];
  const context = useMemo(
    () => ({
      targets: [
        {
          refId: 'A',
          datasource: { type: app.type, uid: evidence.datasourceUid },
          [evidence.signal === 'traces' ? 'query' : 'expr']: getHintDrilldownQuery(hint, evidence.signal),
        },
      ],
      timeRange: { from: String(hint.timeRange.from), to: String(hint.timeRange.to) },
      timeZone: 'utc',
    }),
    [app.type, evidence.datasourceUid, evidence.signal, hint]
  );
  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
    context,
    limitPerPlugin: 1,
  });
  const path = links.find((link) => link.pluginId === app.pluginId)?.path;
  const badge = <Badge color="darkgrey" text={name} />;

  return path ? (
    <Link
      href={path}
      className={styles.signalLink}
      aria-label={t('drilldown-real.hints.open-signal', 'Open {{signal}} Drilldown for {{service}}', {
        signal: name,
        service: hint.scope.value,
      })}
    >
      {badge}
    </Link>
  ) : (
    badge
  );
}

function getSeverities(): Record<HintSeverity, { badge: BadgeColor; trend: TrendColor; label: string }> {
  return {
    slow: { badge: 'orange', trend: 'orange', label: t('drilldown-real.hints.severity-slow', 'Slow') },
    errors: { badge: 'red', trend: 'red', label: t('drilldown-real.hints.severity-errors', 'Errors') },
    deploy: { badge: 'blue', trend: 'green', label: t('drilldown-real.hints.severity-deploy', 'Deploy') },
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
  pagination: css({
    marginLeft: 'auto',
    flexShrink: 0,
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
  signalLink: css({
    display: 'inline-flex',
    borderRadius: theme.shape.radius.pill,
    '&:hover > div': {
      borderColor: theme.colors.border.strong,
    },
    '&:focus-visible': getFocusStyles(theme),
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
    [theme.breakpoints.down('md')]: {
      gridColumn: '2',
    },
  }),
  action: css({
    display: 'flex',
    justifyContent: 'flex-end',
    [theme.breakpoints.down('md')]: {
      gridColumn: '2',
    },
  }),
});
