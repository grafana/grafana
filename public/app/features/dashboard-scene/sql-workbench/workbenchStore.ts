export const OPEN_IN_WORKBENCH_EVENT = 'grafana-sql-proto:open-workbench';
export const OPEN_GRAFANA_SQL_EVENT = 'grafana-sql-proto:open-grafana-sql';

let pendingSql: string | null = null;

export function setPendingWorkbenchSql(sql: string) {
  pendingSql = sql;
}

export function consumePendingWorkbenchSql(): string | null {
  const sql = pendingSql;
  pendingSql = null;
  return sql;
}
