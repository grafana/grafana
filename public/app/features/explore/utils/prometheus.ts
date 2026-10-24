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

/** Metric and label names go in as typed; a label value is quoted after a matcher and escaped for its string. */
export type ExprTextKind = 'name' | 'value';

// The text often completes something the user has opened, like `sum(` or `metric{`, so it follows without a space.
const NO_SEPARATOR_AFTER = /[\s{([,=~]$/;
// `[^=!<>]=` keeps comparisons like `>=` and `==` out.
const MATCHER_END = /(?:[^=!<>]=|!=|[=!]~)\s*$/;
const REGEX_MATCHER_END = /[=!]~\s*$/;
const REGEX_SPECIAL = /[\\.+*?()|[\]{}^$]/g;

interface OpenString {
  quote: string;
  start: number;
}

function findOpenString(expr: string): OpenString | undefined {
  let open: OpenString | undefined;
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    if (open) {
      // Backtick strings are raw, so a backslash escapes nothing in them.
      if (char === '\\' && open.quote !== '`') {
        i++;
      } else if (char === open.quote) {
        open = undefined;
      }
    } else if (char === '#') {
      const newline = expr.indexOf('\n', i);
      i = newline === -1 ? expr.length : newline;
    } else if (char === '"' || char === "'" || char === '`') {
      open = { quote: char, start: i };
    }
  }
  return open;
}

function escapeForString(text: string, quote: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replaceAll(quote, `\\${quote}`);
}

/** Appends `text` to the end of a PromQL expression, the only place the sidebar can reach. */
export function appendToExpr(expr: string | undefined, text: string, kind: ExprTextKind): string {
  if (!expr) {
    return text;
  }

  const open = findOpenString(expr);
  const beforeValue = open ? expr.slice(0, open.start) : expr;
  const value = kind === 'value' && REGEX_MATCHER_END.test(beforeValue) ? text.replace(REGEX_SPECIAL, '\\$&') : text;

  if (open?.quote === '`') {
    // A raw string has no way to escape a backtick.
    return value.includes('`') ? expr : `${expr}${value}`;
  }
  if (open) {
    return `${expr}${escapeForString(value, open.quote)}`;
  }
  if (kind === 'value' && MATCHER_END.test(expr)) {
    return `${expr}"${escapeForString(value, '"')}"`;
  }
  return NO_SEPARATOR_AFTER.test(expr) ? `${expr}${value}` : `${expr} ${value}`;
}

/** Appends `text` to the expression of the query with `refId`, leaving every other query as it was. */
export function appendToQueryExpr(queries: DataQuery[], refId: string, text: string, kind: ExprTextKind): DataQuery[] {
  return queries.map((query) => {
    if (query.refId !== refId) {
      return query;
    }
    return { ...query, expr: appendToExpr(readString(query, 'expr'), text, kind) };
  });
}
