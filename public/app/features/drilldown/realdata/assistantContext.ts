import { type ChatContextItem, createAssistantContextItem } from '@grafana/assistant';
import { t } from '@grafana/i18n';

import { SIGNALS, getUrlDataSource } from '../dataSources';

import { ENTITIES, NOTES, type Hint, type Scope } from './liveScenario';

// What Grafana Assistant is told when the page opens it: the data sources chosen in the URL, so it queries the same
// ones the page reads, and the knowledge graph entity when the scope is one.
export function assistantContext(scope?: Scope, hint?: Hint): ChatContextItem[] {
  const signals = hint
    ? SIGNALS.filter((signal) => signal === 'metrics' || signal === 'logs' || signal === 'traces')
    : SIGNALS;
  const context = signals.flatMap((signal) => {
    const datasourceUid = getUrlDataSource(signal);
    return datasourceUid ? [createAssistantContextItem('datasource', { datasourceUid })] : [];
  });

  if (scope?.type === 'service') {
    const matches = ENTITIES.filter(
      (candidate) =>
        candidate.name === scope.value &&
        (!scope.env || candidate.env === scope.env) &&
        (!scope.namespace || candidate.namespace === scope.namespace)
    );
    const entity = matches.length === 1 ? matches[0] : undefined;
    context.push(
      createAssistantContextItem('entity', {
        type: entity?.type ?? 'Service',
        name: scope.value,
        scope: { env: scope.env ?? entity?.env, namespace: scope.namespace ?? entity?.namespace },
        properties: entity ? { service_type: entity.serviceType, insights: entity.insights.slice(0, 10) } : undefined,
      })
    );
  }
  if (hint) {
    const title = t('drilldown-real.assistant.finding-title', 'Drilldown finding');
    context.push(
      createAssistantContextItem('structured', {
        title,
        data: {
          name: title,
          finding: { title: hint.title, description: hint.description, severity: hint.severity },
          scope: hint.scope,
          timeRange: {
            from: new Date(hint.timeRange.from).toISOString(),
            to: new Date(hint.timeRange.to).toISOString(),
          },
          evidence: hint.evidence,
          drilldownDestinations: hint.evidence.map(({ signal, datasourceUid }) => ({
            type: `drilldown_${signal}`,
            datasourceUid,
          })),
          notMeasured: NOTES.filter((note) => signals.includes(note.source)).map((note) => ({
            source: note.source,
            message: note.message.slice(0, 500),
          })),
          instructions:
            'Treat the attached evidence as observations rather than a confirmed root cause, and report unmeasured sources as unavailable. ' +
            'Execute a query scoped to this service, environment and namespace before offering a Drilldown action. Use the resulting panel_ref with drilldown_logs, drilldown_metrics or drilldown_traces, matching the panel data source. ' +
            "For Logs Drilldown, use an exact detected_level filter for a level observed in the log results instead of the overview's combined level regex. " +
            'Preserve the supplied timeRange using start and end overrides, and display timestamps in UTC. Label the actions "Open Logs Drilldown", "Open Metrics Drilldown" or "Open Traces Drilldown" and explain what each will show in its tooltip. ' +
            'Offer actions for the user to click; do not navigate automatically, invent panel references or URLs, or offer an action for a failed query or unavailable app.',
        },
      })
    );
  }
  return context;
}
