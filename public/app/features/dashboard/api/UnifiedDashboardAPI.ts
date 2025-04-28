import { Dashboard } from '@grafana/schema/dist/esm/index';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { DashboardDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI, DashboardVersionError, DashboardWithAccessInfo } from './types';
import { isV1DashboardCommand, isV2DashboardCommand } from './utils';
import { K8sDashboardAPI } from './v1';
import { K8sDashboardV2API } from './v2';

export class UnifiedDashboardAPI
  implements DashboardAPI<DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>, Dashboard | DashboardV2Spec>
{
  private v1Client: K8sDashboardAPI;
  private v2Client: K8sDashboardV2API;

  constructor() {
    this.v1Client = new K8sDashboardAPI();
    this.v2Client = new K8sDashboardV2API();
  }

  // Get operation depends on the dashboard format to use one of the two clients
  async getDashboardDTO(uid: string) {
    try {
      return await this.v1Client.getDashboardDTO(uid);
    } catch (error) {
      if (error instanceof DashboardVersionError && error.data.storedVersion === 'v2alpha1') {
        return await this.v2Client.getDashboardDTO(uid);
      }
      throw error;
    }
  }

  // Save operation depends on the dashboard format to use one of the two clients
  async saveDashboard(options: SaveDashboardCommand<Dashboard | DashboardV2Spec>) {
    if (isV2DashboardCommand(options)) {
      return await this.v2Client.saveDashboard(options);
    }
    if (isV1DashboardCommand(options)) {
      return await this.v1Client.saveDashboard(options);
    }
    throw new Error('Invalid dashboard command');
  }

  // Delete operation for any version is supported in the v1 client
  async deleteDashboard(uid: string, showSuccessAlert: boolean) {
    return await this.v1Client.deleteDashboard(uid, showSuccessAlert);
  }
}
