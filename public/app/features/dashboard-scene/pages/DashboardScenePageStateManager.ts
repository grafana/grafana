import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';

import { DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

export interface DashboardScenePageState {
  dashboard?: DashboardScene;
  isLoading?: boolean;
  loadError?: string;
}

export class DashboardScenePageStateManager extends StateManagerBase<DashboardScenePageState> {
  private cache: Record<string, DashboardScene> = {};

  async loadAndInit(uid: string) {
    try {
      const scene = await this.loadScene(uid);
      scene.startUrlSync();

      this.cache[uid] = scene;
      this.setState({ dashboard: scene, isLoading: false });
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

    const rsp = await dashboardLoaderSrv.loadDashboard('db', '', uid);

    if (rsp.dashboard) {
      return transformSaveModelToScene(rsp);
    }

    throw new Error('Dashboard not found');
  }

  public clearState() {
    this.setState({ dashboard: undefined, loadError: undefined, isLoading: false });
  }
}

let stateManager: DashboardScenePageStateManager | null = null;

export function getDashboardScenePageStateManager(): DashboardScenePageStateManager {
  if (!stateManager) {
    stateManager = new DashboardScenePageStateManager({});
  }

  return stateManager;
}
