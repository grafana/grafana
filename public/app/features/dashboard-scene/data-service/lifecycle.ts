import { Subject } from 'rxjs';

/*
 * A leaf module, so DashboardScene can report its visits without importing the data service, whose layout imports
 * lead back to DashboardScene.
 */

/** A cached dashboard keeps its scene key when it is opened again, so each activation gets its own id. */
const visitIds = new WeakMap<object, string>();
let visitCount = 0;

/** Visit ids of dashboards as they deactivate. */
export const dashboardVisitEnds = new Subject<string>();

export function startDashboardVisit(dashboard: object) {
  visitCount += 1;
  visitIds.set(dashboard, `dashboard-visit-${visitCount}`);
}

export function endDashboardVisit(dashboard: object) {
  const visitId = visitIds.get(dashboard);
  visitIds.delete(dashboard);
  if (visitId) {
    dashboardVisitEnds.next(visitId);
  }
}

/** Undefined while the dashboard isn't active. */
export function getDashboardVisitId(dashboard: object): string | undefined {
  return visitIds.get(dashboard);
}
