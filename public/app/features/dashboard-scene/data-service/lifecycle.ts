import { Subject } from 'rxjs';

/**
 * Instance keys of dashboards as they deactivate. A leaf module, so DashboardScene can report it without importing
 * the data service, whose layout imports lead back to DashboardScene.
 */
export const dashboardDeactivations = new Subject<string>();
