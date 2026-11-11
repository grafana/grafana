import { type DataQuery, FieldType, LoadingState, type PanelData } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';

export type QueryPreviewOutcome =
  | { kind: 'loading' }
  | { kind: 'no-data' }
  | { kind: 'no-signal' }
  | { kind: 'error'; message?: string }
  | { kind: 'ok'; notices: string[] };

export function classifyQueryPreview(data: PanelData | undefined, refId: string): QueryPreviewOutcome {
  if (!data || data.state === LoadingState.Loading || data.state === LoadingState.Streaming) {
    return { kind: 'loading' };
  }
  const scope = new Set([refId]);
  const expressions = data.request?.targets.filter((query) => isExpressionReference(query.datasource)) ?? [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const query of expressions) {
      if (!scope.has(query.refId) && expressionReferences(query).some((reference) => scope.has(reference))) {
        scope.add(query.refId);
        changed = true;
      }
    }
  }
  const scopedErrors = [...(data.errors ?? []), ...(data.error ? [data.error] : [])].filter(
    (error) => !error.refId || scope.has(error.refId)
  );
  const error = scopedErrors.find((error) => error.message?.trim()) ?? scopedErrors[0];
  if (error) {
    const message = error.message?.trim();
    return { kind: 'error', message: message ? truncateMessage(message) : undefined };
  }
  const frames = data.series.filter((frame) => frame.refId && scope.has(frame.refId));
  const fields = frames.flatMap((frame) => frame.fields.filter((field) => field.type !== FieldType.time));
  if (
    frames.length === 0 ||
    frames.every((frame) => frame.length === 0) ||
    fields.every((field) => field.values.every((value) => value == null))
  ) {
    return { kind: 'no-data' };
  }
  const numericFields = fields.filter((field) => field.type === FieldType.number);
  if (
    numericFields.length > 0 &&
    numericFields.every((field) => field.values.every((value) => value == null || value === 0))
  ) {
    return { kind: 'no-signal' };
  }
  const notices = frames.flatMap(
    (frame) =>
      frame.meta?.notices
        ?.filter((notice) => notice.severity === 'warning')
        .map((notice) => truncateMessage(notice.text)) ?? []
  );
  return { kind: 'ok', notices: [...new Set(notices)] };
}

function truncateMessage(message: string): string {
  return message.length > 500 ? message.slice(0, 499) + '…' : message;
}

function expressionReferences(query: DataQuery): string[] {
  if (
    'type' in query &&
    query.type === 'classic_conditions' &&
    'conditions' in query &&
    Array.isArray(query.conditions)
  ) {
    return query.conditions.flatMap((condition: unknown) => {
      if (!condition || typeof condition !== 'object' || !('query' in condition)) {
        return [];
      }
      const input = condition.query;
      if (!input || typeof input !== 'object' || !('params' in input) || !Array.isArray(input.params)) {
        return [];
      }
      return typeof input.params[0] === 'string' ? [input.params[0]] : [];
    });
  }
  if (!('expression' in query) || typeof query.expression !== 'string') {
    return [];
  }
  const references = Array.from(
    query.expression.matchAll(/\$(?:\{([^}]+)\}|([A-Za-z0-9_]+))/g),
    (match) => match[1] ?? match[2]
  );
  return [query.expression.trim(), ...references];
}
