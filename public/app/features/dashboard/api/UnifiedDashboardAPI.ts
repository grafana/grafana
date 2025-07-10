import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { isResource } from 'app/features/apiserver/guards';
import { Resource, ResourceList } from 'app/features/apiserver/types';
import { DashboardDataDTO, DashboardDTO } from 'app/types/dashboard';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI, DashboardVersionError, DashboardWithAccessInfo, ListDeletedDashboardsOptions } from './types';
import { isDashboardV2Spec, isV1DashboardCommand, isV2DashboardCommand, failedFromVersion } from './utils';
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

  /**
   * List deleted dashboards handling mixed v1/v2 versions or pure v2 dashboards.
   *
   * Steps:
   * 1. Call v1 client to get all deleted dashboards
   * 2. Check if any items have failed conversion from v2 versions
   * 3. If v2 dashboards are detected, call v2 client
   * 4. Filter and combine v1 and v2 dashboards into one response
   */
  async listDeletedDashboards(
    options: ListDeletedDashboardsOptions
  ): Promise<ResourceList<Dashboard | DashboardV2Spec>> {
    const v1Response = await this.v1Client.listDeletedDashboards(options);
    const filteredV1Items = v1Response.items.filter((item) => !failedFromVersion(item, 'v2'));

    if (filteredV1Items.length === v1Response.items.length) {
      return v1Response;
    }

    const v2Response = await this.v2Client.listDeletedDashboards(options);
    const filteredV2Items = v2Response.items.filter((item) => !failedFromVersion(item, 'v1'));

    return {
      ...v2Response,
      items: [...filteredV1Items, ...filteredV2Items],
    };
  }

  async restoreDashboard(dashboard: Resource<DashboardDataDTO | DashboardV2Spec>) {
    // Await returned promise to support proper error handling with try/catch
    if (isDashboardV2Spec(dashboard.spec) && isResource<DashboardV2Spec>(dashboard)) {
      return await this.v2Client.restoreDashboard(dashboard);
    }

    if (isResource<DashboardDataDTO>(dashboard)) {
      return await this.v1Client.restoreDashboard(dashboard);
    }
    throw new Error('Invalid dashboard resource for restore operation');
  }
}
