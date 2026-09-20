/** Tooltips ask the dashboard service for annotation permissions. An embed has no dashboard. */
export function getDashboardSrv() {
  return { getCurrent: () => undefined };
}
