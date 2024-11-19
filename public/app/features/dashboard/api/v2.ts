import { UrlQueryMap } from '@grafana/data';
import { DashboardSpec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { ResourceClient } from 'app/features/apiserver/types';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI, DashboardWithAccessInfo } from './types';

export class K8sDashboardV2APIStub implements DashboardAPI<DashboardWithAccessInfo<DashboardSpec>> {
  // @ts-ignore
  private client: ResourceClient<DashboardSpec>;

  constructor() {
    this.client = new ScopedResourceClient<DashboardSpec>({
      group: 'dashboard.grafana.app',
      version: 'v2alpha1',
      resource: 'dashboards',
    });
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    return await this.client.subresource<DashboardWithAccessInfo<DashboardSpec>>(uid, 'dto');
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    throw new Error('Method not implemented.');
  }

  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO> {
    throw new Error('Method not implemented.');
  }
}
