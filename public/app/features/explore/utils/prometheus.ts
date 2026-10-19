import { matchPluginId, store } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

/**
 * Whether a datasource is Prometheus or one of its managed flavors, such as
 * `grafana-amazonprometheus-datasource`, where only a type id is available - for example
 * on a query's datasource ref in a Mixed pane. With full plugin meta in hand, call
 * `matchPluginId` directly instead.
 *
 * `matchPluginId` resolves Prometheus flavors from the id alone and never consults
 * `aliasIDs` for this particular match, so a bare `{ id }` gives the same answer as full
 * plugin meta. That equivalence is an implementation detail of `matchPluginId` rather than
 * a guarantee, so `prometheus.test.ts` pins it: a caller holding only a type must not
 * silently disagree with one holding meta.
 */
export function isPrometheusType(type: string | undefined | null): boolean {
  return !!type && matchPluginId('prometheus', { id: type });
}

const EDITOR_MODE_DEFAULT_STORAGE_KEY = 'PrometheusQueryEditorModeDefault';

// `DataQuery` carries no Prometheus fields, so they are read off whatever the query holds.
function readString(source: object, key: string): string | undefined {
  const value: unknown = key in source ? Reflect.get(source, key) : undefined;
  return typeof value === 'string' ? value : undefined;
}

export type PrometheusEditorMode = 'code' | 'builder';

/**
 * The mode the Prometheus query editor shows this query in, or `undefined` when the datasource's
 * default editor decides. A query that has never been toggled carries no `editorMode`, so this
 * mirrors how `@grafana/prometheus` picks one, which it does not export.
 */
export function getPrometheusEditorMode(query: DataQuery): PrometheusEditorMode | undefined {
  const editorMode = readString(query, 'editorMode');

  if (editorMode === 'code' || editorMode === 'builder') {
    return editorMode;
  }
  if (readString(query, 'expr')) {
    return 'code';
  }

  const stored = store.get(EDITOR_MODE_DEFAULT_STORAGE_KEY);
  return stored === 'code' || stored === 'builder' ? stored : undefined;
}

/** The default editor a Prometheus datasource's settings name, if any. */
export function getPrometheusDefaultEditor(jsonData: object | undefined): string | undefined {
  return jsonData ? readString(jsonData, 'defaultEditor') : undefined;
}

// The text often completes something the user has opened, like `sum(` or `metric{`, so it follows without a space.
const NO_SEPARATOR_AFTER = /[\s{([,=~]$/;

/** Appends `text` to the end of a PromQL expression, the only place the sidebar can reach. */
export function appendToExpr(expr: string | undefined, text: string): string {
  if (!expr) {
    return text;
  }

  // A trailing quote only opens a string when it is odd-numbered; otherwise it closes one, like `job="api"`.
  const quote = expr.at(-1);
  const opensString = (quote === '"' || quote === "'" || quote === '`') && expr.split(quote).length % 2 === 0;

  return NO_SEPARATOR_AFTER.test(expr) || opensString ? `${expr}${text}` : `${expr} ${text}`;
}

/** Appends `text` to the expression of the query with `refId`, leaving every other query as it was. */
export function appendToQueryExpr(queries: DataQuery[], refId: string, text: string): DataQuery[] {
  return queries.map((query) => {
    if (query.refId !== refId) {
      return query;
    }
    return { ...query, expr: appendToExpr(readString(query, 'expr'), text) };
  });
}
