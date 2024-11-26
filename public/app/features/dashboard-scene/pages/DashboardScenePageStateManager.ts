import { isEqual } from 'lodash';

import { locationUtil, UrlQueryMap } from '@grafana/data';
import { config, getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { getMessageFromError } from 'app/core/utils/errors';
import { startMeasure, stopMeasure } from 'app/core/utils/metrics';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { emitDashboardViewEvent } from 'app/features/dashboard/state/analyticsProcessor';
import { trackDashboardSceneLoaded } from 'app/features/dashboard/utils/tracking';
import { DashboardDTO, DashboardRoutes } from 'app/types';

import { PanelEditor } from '../panel-edit/PanelEditor';
import { DashboardScene } from '../scene/DashboardScene';
import { buildNewDashboardSaveModel } from '../serialization/buildNewDashboardSaveModel';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { restoreDashboardStateFromLocalStorage } from '../utils/dashboardSessionState';

import { updateNavModel } from './utils';

export interface DashboardScenePageState {
  dashboard?: DashboardScene;
  options?: LoadDashboardOptions;
  panelEditor?: PanelEditor;
  isLoading?: boolean;
  loadError?: string;
}

export const DASHBOARD_CACHE_TTL = 500;

const LOAD_SCENE_MEASUREMENT = 'loadDashboardScene';

/** Only used by cache in loading home in DashboardPageProxy and initDashboard (Old arch), can remove this after old dashboard arch is gone */
export const HOME_DASHBOARD_CACHE_KEY = '__grafana_home_uid__';

interface DashboardCacheEntry {
  dashboard: DashboardDTO;
  ts: number;
  cacheKey: string;
}

export interface LoadDashboardOptions {
  uid: string;
  route: DashboardRoutes;
  urlFolderUid?: string;
  params?: {
    version: number;
    scopes: string[];
    timeRange: {
      from: string;
      to: string;
    };
    variables: UrlQueryMap;
  };
}

export class DashboardScenePageStateManager extends StateManagerBase<DashboardScenePageState> {
  private cache: Record<string, DashboardScene> = {};

  // This is a simplistic, short-term cache for DashboardDTOs to avoid fetching the same dashboard multiple times across a short time span.
  private dashboardCache?: DashboardCacheEntry;

  // To eventualy replace the fetchDashboard function from Dashboard redux state management.
  // For now it's a simplistic version to support Home and Normal dashboard routes.
  public async fetchDashboard({
    uid,
    route,
    urlFolderUid,
    params,
  }: LoadDashboardOptions): Promise<DashboardDTO | null> {
    const cacheKey = route === DashboardRoutes.Home ? HOME_DASHBOARD_CACHE_KEY : uid;

    if (!params) {
      const cachedDashboard = this.getDashboardFromCache(cacheKey);

      if (cachedDashboard) {
        return cachedDashboard;
      }
    }

    let rsp: DashboardDTO;

    try {
      switch (route) {
        case DashboardRoutes.New:
          rsp = await buildNewDashboardSaveModel(urlFolderUid);

          break;
        case DashboardRoutes.Home:
          rsp = await getBackendSrv().get('/api/dashboards/home');

          if (rsp.redirectUri) {
            return rsp;
          }

          if (rsp?.meta) {
            rsp.meta.canSave = false;
            rsp.meta.canShare = false;
            rsp.meta.canStar = false;
          }

          break;
        case DashboardRoutes.Public: {
          return await dashboardLoaderSrv.loadDashboard('public', '', uid);
        }
        default:
          const queryParams = params
            ? {
                version: params.version,
                scopes: params.scopes,
                from: params.timeRange.from,
                to: params.timeRange.to,
                ...params.variables,
              }
            : undefined;
          rsp = await dashboardLoaderSrv.loadDashboard('db', '', uid, queryParams);

          if (route === DashboardRoutes.Embedded) {
            rsp.meta.isEmbedded = true;
          }
      }

      if (rsp.meta.url && route === DashboardRoutes.Normal) {
        const dashboardUrl = locationUtil.stripBaseFromUrl(rsp.meta.url);
        const currentPath = locationService.getLocation().pathname;

        if (dashboardUrl !== currentPath) {
          // Spread current location to persist search params used for navigation
          locationService.replace({
            ...locationService.getLocation(),
            pathname: dashboardUrl,
          });
          console.log('not correct url correcting', dashboardUrl, currentPath);
        }
      }

      // Populate nav model in global store according to the folder
      if (rsp.meta.folderUid) {
        await updateNavModel(rsp.meta.folderUid);
      }

      // Do not cache new dashboards
      this.setDashboardCache(cacheKey, rsp);
    } catch (e) {
      // Ignore cancelled errors
      if (isFetchError(e) && e.cancelled) {
        return null;
      }

      throw e;
    }

    return rsp;
  }

  public async loadSnapshot(slug: string) {
    try {
      const dashboard = await this.loadSnapshotScene(slug);

      this.setState({ dashboard: dashboard, isLoading: false });
    } catch (err) {
      this.setState({ isLoading: false, loadError: String(err) });
    }
  }

  private async loadSnapshotScene(slug: string): Promise<DashboardScene> {
    const rsp = await dashboardLoaderSrv.loadDashboard('snapshot', slug, '');

    if (rsp?.dashboard) {
      const scene = transformSaveModelToScene(rsp);
      return scene;
    }

    throw new Error('Snapshot not found');
  }

  public async loadDashboard(options: LoadDashboardOptions) {
    try {
      startMeasure(LOAD_SCENE_MEASUREMENT);
      const dashboard = await this.loadScene(options);
      if (!dashboard) {
        return;
      }

      if (config.featureToggles.preserveDashboardStateWhenNavigating && Boolean(options.uid)) {
        restoreDashboardStateFromLocalStorage(dashboard);
      }

      this.setState({ dashboard: dashboard, isLoading: false, options });
      const measure = stopMeasure(LOAD_SCENE_MEASUREMENT);
      trackDashboardSceneLoaded(dashboard, measure?.duration);

      if (options.route !== DashboardRoutes.New) {
        emitDashboardViewEvent({
          meta: dashboard.state.meta,
          uid: dashboard.state.uid,
          title: dashboard.state.title,
          id: dashboard.state.id,
        });
      }
    } catch (err) {
      const msg = getMessageFromError(err);
      this.setState({ isLoading: false, loadError: msg });
    }
  }

  public async reloadDashboard(params: LoadDashboardOptions['params']) {
    const stateOptions = this.state.options;

    if (!stateOptions) {
      return;
    }

    const options = {
      ...stateOptions,
      params,
    };

    // We shouldn't check all params since:
    // - version doesn't impact the new dashboard, and it's there for increased compatibility
    // - time range is almost always different for relative time ranges and absolute time ranges do not trigger subsequent reloads
    // - other params don't affect the dashboard content
    if (
      isEqual(options.params?.variables, stateOptions.params?.variables) &&
      isEqual(options.params?.scopes, stateOptions.params?.scopes)
    ) {
      return;
    }

    try {
      this.setState({ isLoading: true });

      const rsp = await this.fetchDashboard(options);
      const fromCache = this.getSceneFromCache(options.uid);

      if (fromCache && fromCache.state.version === rsp?.dashboard.version) {
        this.setState({ isLoading: false });
        return;
      }

      if (!rsp?.dashboard) {
        this.setState({ isLoading: false, loadError: 'Dashboard not found' });
        return;
      }

      const scene = transformSaveModelToScene(rsp);

      this.setSceneCache(options.uid, scene);

      this.setState({ dashboard: scene, isLoading: false, options });
    } catch (err) {
      const msg = getMessageFromError(err);
      this.setState({ isLoading: false, loadError: msg });
    }
  }

  private async loadScene(options: LoadDashboardOptions): Promise<DashboardScene | null> {
    this.setState({ dashboard: undefined, isLoading: true });

    const rsp = await this.fetchDashboard(options);

    const fromCache = this.getSceneFromCache(options.uid);
    if (fromCache && fromCache.state.version === rsp?.dashboard.version) {
      return fromCache;
    }

    if (rsp?.dashboard) {
      const scene = transformSaveModelToScene(rsp);

      // Cache scene only if not coming from Explore, we don't want to cache temporary dashboard
      if (options.uid) {
        this.setSceneCache(options.uid, scene);
      }

      return scene;
    }

    if (rsp?.redirectUri) {
      const newUrl = locationUtil.stripBaseFromUrl(rsp.redirectUri);
      locationService.replace(newUrl);
      return null;
    }

    throw new Error('Dashboard not found');
  }

  public getDashboardFromCache(cacheKey: string) {
    const cachedDashboard = this.dashboardCache;

    if (
      cachedDashboard &&
      cachedDashboard.cacheKey === cacheKey &&
      Date.now() - cachedDashboard?.ts < DASHBOARD_CACHE_TTL
    ) {
      return cachedDashboard.dashboard;
    }

    return null;
  }

  public clearState() {
    getDashboardSrv().setCurrent(undefined);

    this.setState({
      dashboard: undefined,
      loadError: undefined,
      isLoading: false,
      panelEditor: undefined,
    });
  }

  public setDashboardCache(cacheKey: string, dashboard: DashboardDTO) {
    this.dashboardCache = { dashboard, ts: Date.now(), cacheKey };
  }

  public clearDashboardCache() {
    this.dashboardCache = undefined;
  }

  public getSceneFromCache(cacheKey: string) {
    return this.cache[cacheKey];
  }

  public setSceneCache(cacheKey: string, scene: DashboardScene) {
    this.cache[cacheKey] = scene;
  }

  public clearSceneCache() {
    this.cache = {};
  }
}

let stateManager: DashboardScenePageStateManager | null = null;

export function getDashboardScenePageStateManager(): DashboardScenePageStateManager {
  if (!stateManager) {
    stateManager = new DashboardScenePageStateManager({});
  }

  return stateManager;
}
