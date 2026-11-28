import { getBackendSrv } from '@grafana/runtime';

import { requireDataSource } from '../dataSources';

export type Severity = 'critical' | 'warning' | 'info';

export interface KgEntity {
  id: number;
  name: string;
  type: string;
  env?: string;
  namespace?: string;
  serviceType?: string;
  // The worst severity among the entity's current insights, or undefined when it has none.
  severity?: Severity;
  insights: string[];
}

export interface EntitySearch {
  entities: KgEntity[];
  // False when the knowledge graph holds more matches than the one page it returned.
  complete: boolean;
}

interface SearchEntity {
  id: number;
  type: string;
  name: string;
  scope?: Record<string, string>;
  properties?: Record<string, unknown>;
  assertion?: { severity?: string; assertions?: Array<{ assertionName?: string }> };
}

interface SearchResponse {
  data?: { entities?: SearchEntity[]; lastPage?: boolean };
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };

function toSeverity(raw: string | undefined): Severity | undefined {
  return raw === 'critical' || raw === 'warning' || raw === 'info' ? raw : undefined;
}

function toEntity(entity: SearchEntity): KgEntity {
  const serviceType = entity.properties?.service_type;
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    env: entity.scope?.env,
    namespace: entity.scope?.namespace,
    serviceType: typeof serviceType === 'string' ? serviceType : undefined,
    severity: toSeverity(entity.assertion?.severity),
    insights: (entity.assertion?.assertions ?? []).flatMap((assertion) =>
      assertion.assertionName ? [assertion.assertionName] : []
    ),
  };
}

const nameOrder = new Intl.Collator();

// Entities that need attention come first, then by how many insights they carry.
function byAttention(a: KgEntity, b: KgEntity): number {
  const rank = (entity: KgEntity) => (entity.severity ? SEVERITY_RANK[entity.severity] : 0);
  return rank(b) - rank(a) || b.insights.length - a.insights.length || nameOrder.compare(a.name, b.name);
}

// The search API rejects a request with no condition, so every entity that has a name is matched.
export async function searchEntities(entityType: string, startMs: number, endMs: number): Promise<EntitySearch> {
  const uid = await requireDataSource('knowledgegraph');
  const response = await getBackendSrv().post<SearchResponse>(
    `/api/datasources/uid/${uid}/resources/api-server/v1/search`,
    {
      filterCriteria: [
        {
          entityType,
          propertyMatchers: [{ id: 0, name: 'name', op: 'IS NOT NULL', type: 'String', value: '' }],
          havingAssertion: false,
          havingPropagatedAssertions: false,
        },
      ],
      timeCriteria: { start: startMs, end: endMs },
    },
    { showErrorAlert: false }
  );
  return {
    entities: (response.data?.entities ?? []).map(toEntity).sort(byAttention),
    complete: response.data?.lastPage !== false,
  };
}
