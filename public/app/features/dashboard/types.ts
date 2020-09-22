import { DashboardDTO } from 'app/types';
import { Observable } from 'rxjs';

export interface DashboardLoaderSupport {
  /**
   * Currently only the first value is used, but would be nice to keep the dashboard up-to-date
   */
  loadDashboard(path: string): Observable<DashboardDTO>;

  /**
   * Save dashboard?
   */
  // saveDashboard?: (options:SaveDashboardOptions) => Promise<any>;
}
