import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { DashboardDTO } from 'app/types';

import { SceneFlexLayout } from '../components/SceneFlexLayout';

import { DashboardScene } from './DashboardScene';

export interface DashboardLoaderState {
  dashboard?: DashboardScene;
  isLoading?: boolean;
  loadError?: string;
}

export class DashboardLoader extends StateManagerBase<DashboardLoaderState> {
  async load(uid: string) {
    this.setState({ isLoading: true });

    try {
      const rsp = await dashboardLoaderSrv.loadDashboard('db', '', uid);

      if (rsp.dashboard) {
        this.initDashboard(rsp);
      } else {
        throw new Error('No dashboard returned');
      }
    } catch (err) {
      this.setState({ isLoading: false, loadError: String(err) });
    }
  }

  initDashboard(rsp: DashboardDTO) {
    const dashboard = new DashboardScene({
      title: rsp.dashboard.title,
      layout: new SceneFlexLayout({
        children: [],
      }),
    });

    this.setState({ dashboard, isLoading: false });
  }
}

let loader: DashboardLoader | null = null;

export function getDashboardLoader(): DashboardLoader {
  if (!loader) {
    loader = new DashboardLoader({});
  }

  return loader;
}
