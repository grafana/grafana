import { UrlQueryMap } from '@grafana/data';
import { Dashboard } from '@grafana/schema/dist/esm/index';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
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
    this.v2Client = new K8sDashboardV2API(false);
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    try {
      return await this.v1Client.getDashboardDTO(uid);
    } catch (error) {
      if (error instanceof DashboardVersionError && error.data.isV2) {
        return await this.v2Client.getDashboardDTO(uid, params);
      }
      throw error;
    }
  }

  async saveDashboard(options: SaveDashboardCommand<Dashboard | DashboardV2Spec>) {
    if (isV2DashboardCommand(options)) {
      return await this.v2Client.saveDashboard(options);
    }
    if (isV1DashboardCommand(options)) {
      return await this.v1Client.saveDashboard(options);
    }
    throw new Error('Invalid dashboard command');
  }

  async deleteDashboard(uid: string, showSuccessAlert: boolean) {
    try {
      return await this.v1Client.deleteDashboard(uid, showSuccessAlert);
    } catch (error) {
      if (error instanceof DashboardVersionError && error.data.isV2) {
        return await this.v2Client.deleteDashboard(uid, showSuccessAlert);
      }
      throw error;
    }
  }
}
