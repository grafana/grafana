export const OPEN_IN_WORKBENCH_EVENT = 'grafana-sql-proto:open-workbench';
export const OPEN_GRAFANA_SQL_EVENT = 'grafana-sql-proto:open-grafana-sql';

// Module-level pub/sub for the active SQL line (bidirectional card ↔ editor sync)
type LineListener = (line: number | null) => void;
let _activeSqlLine: number | null = null;
const _lineListeners: LineListener[] = [];

export function setGrafanaSqlActiveLine(line: number | null) {
  _activeSqlLine = line;
  _lineListeners.forEach((l) => l(line));
}

export function subscribeGrafanaSqlActiveLine(listener: LineListener) {
  _lineListeners.push(listener);
  return () => {
    const i = _lineListeners.indexOf(listener);
    if (i >= 0) {
      _lineListeners.splice(i, 1);
    }
  };
}

export function getGrafanaSqlActiveLine() {
  return _activeSqlLine;
}

let pendingSql: string | null = null;

export function setPendingWorkbenchSql(sql: string) {
  pendingSql = sql;
}

export function consumePendingWorkbenchSql(): string | null {
  const sql = pendingSql;
  pendingSql = null;
  return sql;
}
