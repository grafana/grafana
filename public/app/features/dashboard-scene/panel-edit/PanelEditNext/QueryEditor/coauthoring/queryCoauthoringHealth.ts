import { type DataQuery, LoadingState, type PanelData } from '@grafana/data';

import { type QueryCoauthoringHealth } from './queryCoauthoringContracts';
import { expressionReferences } from './queryCoauthoringDependencies';
import { classifyQueryResult, type QueryPreviewOutcome } from './queryCoauthoringPreviewOutcome';

export function deriveQueryHealth(
  queries: DataQuery[],
  data: PanelData | undefined
): Record<string, QueryCoauthoringHealth> {
  return Object.fromEntries(
    queries.map((query) => {
      const outcome = classifyQueryResult(data, query.refId);
      return [
        query.refId,
        query.hide ||
        outcome.kind === 'loading' ||
        (data?.request && !data.request.targets.some((target) => target.refId === query.refId))
          ? 'unknown'
          : outcome.kind,
      ];
    })
  );
}

export function isQueryBroken(
  refId: string,
  queries: DataQuery[],
  health: Record<string, QueryCoauthoringHealth>
): boolean {
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visited.has(id)) {
      return false;
    }
    visited.add(id);
    if (health[id] === 'error' || health[id] === 'no-data') {
      return true;
    }
    const query = queries.find((candidate) => candidate.refId === id);
    return query ? expressionReferences(query).some(visit) : false;
  };
  return visit(refId);
}

export function classifyOptionOutcome(
  data: PanelData | undefined,
  queries: DataQuery[],
  changedRefIds: string[]
): QueryPreviewOutcome & { warnings?: string[] } {
  if (!data || data.state === LoadingState.Loading || data.state === LoadingState.Streaming) {
    return { kind: 'loading' };
  }
  const scope = new Set(changedRefIds);
  let size = -1;
  while (size !== scope.size) {
    size = scope.size;
    for (const query of queries) {
      if (expressionReferences(query).some((refId) => scope.has(refId))) {
        scope.add(query.refId);
      }
    }
  }
  const rank = { loading: 0, ok: 1, 'no-signal': 2, 'no-data': 3, error: 4 };
  let worst: QueryPreviewOutcome = { kind: 'ok', notices: [] };
  for (const refId of scope) {
    const outcome = classifyQueryResult(data, refId);
    if (queries.find((query) => query.refId === refId)?.hide && outcome.kind !== 'error') {
      continue;
    }
    if (rank[outcome.kind] > rank[worst.kind]) {
      worst = outcome;
    }
  }
  const warnings = data.series
    .filter((frame) => frame.refId && scope.has(frame.refId))
    .flatMap(
      (frame) =>
        frame.meta?.notices?.filter((notice) => notice.severity === 'warning').map((notice) => notice.text) ?? []
    );
  return { ...worst, warnings: [...new Set(warnings)] };
}
