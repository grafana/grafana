import { getBackendSrv } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardDTO, DashboardRoutes } from 'app/types';

import { buildPanelEditScene, PanelEditor } from '../panel-edit/PanelEditor';
import { DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { getVizPanelKeyForPanelId, findVizPanelByKey } from '../utils/utils';

export interface DashboardScenePageState {
  dashboard?: DashboardScene;
  panelEditor?: PanelEditor;
  isLoading?: boolean;
  loadError?: string;
}

export class DashboardScenePageStateManager extends StateManagerBase<DashboardScenePageState> {
  private cache: Record<string, DashboardScene> = {};

  public async loadDashboard(uid: string) {
    try {
      const dashboard = await this.loadScene(uid);
      dashboard.startUrlSync();

      this.setState({ dashboard: dashboard, isLoading: false });
    } catch (err) {
      this.setState({ isLoading: false, loadError: String(err) });
    }
  }

  public async loadPanelEdit(uid: string, panelId: string) {
    try {
      const dashboard = await this.loadScene(uid);
      const panel = findVizPanelByKey(dashboard, getVizPanelKeyForPanelId(parseInt(panelId, 10)));

      if (!panel) {
        this.setState({ isLoading: false, loadError: 'Panel not found' });
        return;
      }

      const panelEditor = buildPanelEditScene(dashboard, panel);
      panelEditor.startUrlSync();

      this.setState({ isLoading: false, panelEditor });
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

    let rsp: DashboardDTO | undefined;

    if (uid === DashboardRoutes.Home) {
      rsp = await getBackendSrv().get('/api/dashboards/home');

      // TODO
      // if user specified a custom home dashboard redirect to that
      // if (rsp?.redirectUri) {
      //   const newUrl = locationUtil.stripBaseFromUrl(rsp.redirectUri);
      //   locationService.replace(newUrl);
      // }

      if (rsp?.meta) {
        rsp.meta.canSave = false;
        rsp.meta.canShare = false;
        rsp.meta.canStar = false;
      }
    } else {
      rsp = await dashboardLoaderSrv.loadDashboard('db', '', uid);
    }

    if (rsp?.dashboard) {
      const scene = transformSaveModelToScene(rsp);

      this.cache[uid] = scene;
      return scene;
    }

    throw new Error('Dashboard not found');
  }

  public clearState() {
    getDashboardSrv().setCurrent(undefined);
    this.setState({ dashboard: undefined, loadError: undefined, isLoading: false, panelEditor: undefined });
  }
}

let stateManager: DashboardScenePageStateManager | null = null;

export function getDashboardScenePageStateManager(): DashboardScenePageStateManager {
  if (!stateManager) {
    stateManager = new DashboardScenePageStateManager({});
  }

  return stateManager;
}
