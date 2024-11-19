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
    // const spec: DashboardSpec = {
    //   annotations: [],
    //   cursorSync: DashboardCursorSync.Off,
    //   title: 'Random dash',
    //   description: '',
    //   elements: {},
    //   layout: {
    //     kind: 'GridLayout',
    //     spec: {
    //       items: [],
    //     },
    //   },
    //   links: [],
    //   variables: [],
    //   preload: false,
    //   // @ts-ignore
    //   timeSettings: {
    //     from: 'now-6h',
    //     to: 'now',
    //   },
    // };
    // const resultResource: DashboardWithAccessInfo<DashboardSpec> = {
    //   kind: 'DashboardWithAccessInfo',
    //   apiVersion: 'dashboard.grafana.app/v2alpha1',
    //   spec,
    //   metadata: {
    //     name: uid,
    //     namespace: 'default',
    //     resourceVersion: '24600000004',
    //     creationTimestamp: '2024-03-20T16:41:16Z',
    //   },
    //   // will be provided by the subresource call
    //   access: { url: 'whatever for now, just testing' },
    // };
    // return resultResource;
    throw new Error('Method not implemented.');
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    throw new Error('Method not implemented.');
  }

  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO> {
    throw new Error('Method not implemented.');
  }
}
