import { isFetchError } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { DashboardDTO } from 'app/types';

import { DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

export interface DashboardScenePageState {
  dashboard?: DashboardScene;
  isLoading?: boolean;
  loadError?: string;
}

export class DashboardSnapshotStateManager extends StateManagerBase<DashboardScenePageState> {
  private cache: Record<string, DashboardScene> = {};

  private async fetchSnapshot(uid: string) {
    let rsp: DashboardDTO | undefined;

    try {
      rsp = await dashboardLoaderSrv.loadDashboard('snapshot', uid, '');
    } catch (e) {
      // Ignore cancelled errors
      if (isFetchError(e) && e.cancelled) {
        return null;
      }

      console.error(e);
      throw e;
    }

    return rsp;
  }

  public async loadSnapshot(uid: string) {
    try {
      const dashboard = await this.loadScene(uid);
      dashboard.startUrlSync();

      this.setState({ dashboard: dashboard, isLoading: false });
    } catch (err) {
      this.setState({ isLoading: false, loadError: String(err) });
    }
  }

  private async loadScene(uid: string): Promise<DashboardScene> {
    const fromCache = this.cache[uid];
    if (fromCache) {
      return fromCache;
    }

    this.setState({ isLoading: true });

    const rsp = await this.fetchSnapshot(uid);

    if (rsp?.dashboard) {
      const scene = transformSaveModelToScene(rsp);

      this.cache[uid] = scene;
      return scene;
    }

    throw new Error('Snapshot not found');
  }

  public clearState() {
    this.setState({ dashboard: undefined, loadError: undefined, isLoading: false });
  }
}

let stateManager: DashboardSnapshotStateManager | null = null;

export function getDashboardSnapshotStateManager(): DashboardSnapshotStateManager {
  if (!stateManager) {
    stateManager = new DashboardSnapshotStateManager({});
  }

  return stateManager;
}
