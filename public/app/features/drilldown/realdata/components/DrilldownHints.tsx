import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { Badge, type BadgeColor, Button, Icon, LinkButton, Pagination, Stack, Text, useStyles2 } from '@grafana/ui';

import { assistantContext } from '../assistantContext';
import { type Hint, type HintEvidence, type HintSeverity, HINTS, NOTES } from '../liveScenario';
import { getHintDrilldownQuery, scopeKey } from '../loadScenario';

import { AssistantIcon } from './AssistantIcon';
import { getAppNames } from './DrilldownInsights';

interface Props {
  hints?: Hint[];
}

const PAGE_SIZE = 3;

const SIGNAL_APPS = {
  metrics: { type: 'prometheus', pluginId: 'grafana-metricsdrilldown-app', icon: 'chart-line' },
  logs: { type: 'loki', pluginId: 'grafana-lokiexplore-app', icon: 'file-alt' },
  traces: { type: 'tempo', pluginId: 'grafana-exploretraces-app', icon: 'gf-traces' },
} as const;

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
  const serviceCount = new Set(hints.map((hint) => scopeKey(hint.scope))).size;

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
      <div className={styles.header}>
        <Stack gap={1} alignItems="center" justifyContent="space-between" wrap="wrap">
          <Stack gap={1} alignItems="center" wrap="wrap">
            <Text element="h2" variant="h4" weight="medium" id="drilldown-hints-title">
              {t('drilldown-real.hints.recommendations-title', 'Recommendations')}
            </Text>
            <Text variant="bodySmall" color="secondary">
              {t('drilldown-real.hints.service-count', '', {
                count: serviceCount,
                defaultValue_one: '{{count}} service',
                defaultValue_other: '{{count}} services',
              })}
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
        <Stack gap={1} alignItems="center">
          <Icon name="ai-sparkle" size="sm" />
          <Text variant="bodySmall" color="secondary">
            {t(
              'drilldown-real.hints.recommendations-subtitle',
              'Detected in the last 30 minutes across your selected signals'
            )}
          </Text>
        </Stack>
      </div>
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
              <div className={styles.details}>
                <div className={styles.title}>
                  <Badge className={styles.badge} color={severity.badge} text={severity.label} />
                  <span className={styles.titleText}>
                    <Text weight="medium">{hint.title}</Text>
                  </span>
                </div>
                <Text variant="bodySmall" color="secondary">
                  {hint.description}
                </Text>
              </div>
              <div className={styles.action}>
                {[...new Map(hint.evidence.map((item) => [item.signal, item])).values()].map((evidence) => (
                  <BuildSignalLink
                    key={evidence.signal}
                    hint={hint}
                    evidence={evidence}
                    name={appNames[evidence.signal]}
                  />
                ))}
                {hint.investigable && (
                  <Button
                    size="sm"
                    variant="secondary"
                    fill="text"
                    icon={<AssistantIcon />}
                    aria-label={t('drilldown-real.hints.ask-about-finding', 'Ask Grafana Assistant about {{finding}}', {
                      finding: hint.title,
                    })}
                    tooltip={t('drilldown-real.hints.explain-with-assistant', 'Explain with Grafana Assistant')}
                    onClick={() => onInvestigate(hint)}
                  />
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
  const app = SIGNAL_APPS[evidence.signal];
  const label = {
    metrics: t('drilldown-real.hints.view-metrics', 'View metrics'),
    logs: t('drilldown-real.hints.view-logs', 'View logs'),
    traces: t('drilldown-real.hints.view-traces', 'View traces'),
  }[evidence.signal];
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
  return path ? (
    <LinkButton
      href={path}
      size="sm"
      variant="secondary"
      icon={app.icon}
      aria-label={t('drilldown-real.hints.open-signal', 'Open {{signal}} Drilldown for {{service}}', {
        signal: name,
        service: hint.scope.value,
      })}
    >
      {label}
    </LinkButton>
  ) : (
    <Button size="sm" variant="secondary" icon={app.icon} disabled>
      {label}
    </Button>
  );
}

function getSeverities(): Record<HintSeverity, { badge: BadgeColor; label: string }> {
  return {
    slow: { badge: 'orange', label: t('drilldown-real.hints.severity-slow', 'Slow') },
    errors: { badge: 'red', label: t('drilldown-real.hints.severity-errors', 'Errors') },
    deploy: { badge: 'blue', label: t('drilldown-real.hints.severity-deploy', 'Deploy') },
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  hints: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  header: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  list: css({
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    padding: 0,
  }),
  pagination: css({
    marginLeft: 'auto',
    flexShrink: 0,
  }),
  hint: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    columnGap: theme.spacing(3),
    rowGap: theme.spacing(1),
    padding: theme.spacing(1.25, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  }),
  details: css({
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  title: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
  }),
  titleText: css({
    minWidth: 0,
    overflowWrap: 'anywhere',
  }),
  badge: css({
    flexShrink: 0,
    borderRadius: theme.shape.radius.sm,
  }),
  empty: css({
    padding: theme.spacing(2),
    border: `1px dashed ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  action: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  }),
});
