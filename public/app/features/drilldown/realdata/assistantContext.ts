import { type ChatContextItem, createAssistantContextItem } from '@grafana/assistant';

import { SIGNALS, getUrlDataSource } from '../dataSources';

import { ENTITIES, type Scope } from './liveScenario';

// What Grafana Assistant is told when the page opens it: the data sources chosen in the URL, so it queries the same
// ones the page reads, and the knowledge graph entity when the scope is one.
export function assistantContext(scope?: Scope): ChatContextItem[] {
  const context = SIGNALS.flatMap((signal) => {
    const datasourceUid = getUrlDataSource(signal);
    return datasourceUid ? [createAssistantContextItem('datasource', { datasourceUid })] : [];
  });

  const entity = scope?.type === 'service' ? ENTITIES.find((candidate) => candidate.name === scope.value) : undefined;
  if (entity) {
    context.push(
      createAssistantContextItem('entity', {
        type: entity.type,
        name: entity.name,
        scope: { env: entity.env, namespace: entity.namespace },
        properties: { service_type: entity.serviceType, insights: entity.insights },
      })
    );
  }
  return context;
}
