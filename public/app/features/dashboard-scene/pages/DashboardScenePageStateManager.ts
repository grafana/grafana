import { locationUtil, UrlQueryMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { BASE_URL } from 'app/api/clients/provisioning/v0alpha1/baseAPI';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { getMessageFromError, getMessageIdFromError, getStatusFromError } from 'app/core/utils/errors';
import { startMeasure, stopMeasure } from 'app/core/utils/metrics';
import {
  AnnoKeyEmbedded,
  AnnoKeyFolder,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
} from 'app/features/apiserver/types';
import { ensureV2Response, transformDashboardV2SpecToV1 } from 'app/features/dashboard/api/ResponseTransformers';
import { DashboardVersionError, DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { isDashboardV2Resource, isDashboardV2Spec, isV2StoredVersion } from 'app/features/dashboard/api/utils';
import { dashboardLoaderSrv, DashboardLoaderSrvV2 } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { emitDashboardViewEvent } from 'app/features/dashboard/state/analyticsProcessor';
import { trackDashboardSceneLoaded } from 'app/features/dashboard/utils/tracking';
import { ProvisioningPreview } from 'app/features/provisioning/types';
import {
  DashboardDataDTO,
  DashboardDTO,
  DashboardRoutes,
  HomeDashboardRedirectDTO,
  isRedirectResponse,
} from 'app/types/dashboard';

import { PanelEditor } from '../panel-edit/PanelEditor';
import { DashboardScene } from '../scene/DashboardScene';
import { buildNewDashboardSaveModel, buildNewDashboardSaveModelV2 } from '../serialization/buildNewDashboardSaveModel';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { restoreDashboardStateFromLocalStorage } from '../utils/dashboardSessionState';

import { processQueryParamsForDashboardLoad, updateNavModel } from './utils';

export interface LoadError {
  status?: number;
  messageId?: string;
  message: string;
}

export interface DashboardScenePageState {
  dashboard?: DashboardScene;
  panelEditor?: PanelEditor;
  isLoading?: boolean;
  loadError?: LoadError;
}

export const DASHBOARD_CACHE_TTL = 500;

const LOAD_SCENE_MEASUREMENT = 'loadDashboardScene';

/** Only used by cache in loading home in DashboardPageProxy and initDashboard (Old arch), can remove this after old dashboard arch is gone */
export const HOME_DASHBOARD_CACHE_KEY = '__grafana_home_uid__';

interface DashboardCacheEntry<T> {
  dashboard: T;
  ts: number;
  cacheKey: string;
}

export interface LoadDashboardOptions {
  uid: string;
  route: DashboardRoutes;
  slug?: string;
  type?: string;
  urlFolderUid?: string;
}

export type HomeDashboardDTO = DashboardDTO & {
  dashboard: DashboardDataDTO | DashboardV2Spec;
};

interface DashboardScenePageStateManagerLike<T> {
  fetchDashboard(options: LoadDashboardOptions): Promise<T | null>;
  getDashboardFromCache(cacheKey: string): T | null;
  loadDashboard(options: LoadDashboardOptions): Promise<void>;
  transformResponseToScene(rsp: T | null, options: LoadDashboardOptions): DashboardScene | null;
  reloadDashboard(queryParams: UrlQueryMap): Promise<void>;
  loadSnapshot(slug: string): Promise<void>;
  setDashboardCache(cacheKey: string, dashboard: T): void;
  clearSceneCache(): void;
  clearDashboardCache(): void;
  clearState(): void;
  getCache(): Record<string, DashboardScene>;
  useState: () => DashboardScenePageState;
}

abstract class DashboardScenePageStateManagerBase<T>
  extends StateManagerBase<DashboardScenePageState>
  implements DashboardScenePageStateManagerLike<T>
{
  abstract fetchDashboard(options: LoadDashboardOptions): Promise<T | null>;
  abstract reloadDashboard(queryParams: UrlQueryMap): Promise<void>;
  abstract transformResponseToScene(rsp: T | null, options: LoadDashboardOptions): DashboardScene | null;
  abstract loadSnapshotScene(slug: string): Promise<DashboardScene>;

  protected cache: Record<string, DashboardScene> = {};

  // This is a simplistic, short-term cache for DashboardDTOs to avoid fetching the same dashboard multiple times across a short time span.
  protected dashboardCache?: DashboardCacheEntry<T>;

  getCache(): Record<string, DashboardScene> {
    return this.cache;
  }

  protected async fetchHomeDashboard(): Promise<DashboardDTO | null> {
    const rsp = await getBackendSrv().get<HomeDashboardDTO | HomeDashboardRedirectDTO>('/api/dashboards/home');

    if (isRedirectResponse(rsp)) {
      const newUrl = locationUtil.stripBaseFromUrl(rsp.redirectUri);
      locationService.replace(newUrl);
      return null;
    }

    // If dashboard is on v2 schema convert to v1 schema, there's curently no v2 API for home dashboard
    if (isDashboardV2Spec(rsp.dashboard)) {
      rsp.dashboard = transformDashboardV2SpecToV1(rsp.dashboard, {
        name: '',
        generation: 0,
        resourceVersion: '0',
        creationTimestamp: '',
      });
    }

    if (rsp?.meta) {
      rsp.meta.canSave = false;
      rsp.meta.canShare = false;
      rsp.meta.canStar = false;
    }

    return rsp;
  }

  private async loadHomeDashboard(): Promise<DashboardScene | null> {
    const rsp = await this.fetchHomeDashboard();
    if (rsp) {
      return transformSaveModelToScene(rsp);
    }

    return null;
  }

  public async loadSnapshot(slug: string) {
    try {
      const dashboard = await this.loadSnapshotScene(slug);

      this.setState({ dashboard: dashboard, isLoading: false });
    } catch (err) {
      const status = getStatusFromError(err);
      const message = getMessageFromError(err);
      const messageId = getMessageIdFromError(err);

      this.setState({
        isLoading: false,
        loadError: {
          status,
          message,
          messageId,
        },
      });
      // If the error is a DashboardVersionError, we want to throw it so that the error boundary is triggered
      // This enables us to switch to the correct version of the dashboard
      if (err instanceof DashboardVersionError) {
        throw err;
      }
    }
  }

  protected async loadProvisioningDashboard(repo: string, path: string): Promise<T> {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') ?? undefined; // commit hash or branch

    const url = `${BASE_URL}/repositories/${repo}/files/${path}`;
    return getBackendSrv()
      .get(url, ref ? { ref } : undefined)
      .then((v) => {
        // Load the results from dryRun
        const dryRun = v.resource.dryRun;
        if (!dryRun) {
          return Promise.reject('failed to read provisioned dashboard');
        }

        if (!dryRun.apiVersion.startsWith('dashboard.grafana.app')) {
          return Promise.reject('unexpected resource type: ' + dryRun.apiVersion);
        }

        return this.processDashboardFromProvisioning(repo, path, dryRun, {
          file: url,
          ref: ref,
          repo: repo,
        });
      });
  }

  private processDashboardFromProvisioning(
    repo: string,
    path: string,
    dryRun: any,
    provisioningPreview: ProvisioningPreview
  ) {
    if (dryRun.apiVersion.split('/')[1] === 'v2beta1') {
      return {
        ...dryRun,
        kind: 'DashboardWithAccessInfo',
        access: {
          canStar: false,
          isSnapshot: false,
          canShare: false,

          // Should come from the repo settings
          canDelete: true,
          canSave: true,
          canEdit: true,
        },
      };
    }

    let anno = dryRun.metadata.annotations;
    if (!anno) {
      dryRun.metadata.annotations = {};
    }
    anno[AnnoKeyManagerKind] = 'repo';
    anno[AnnoKeyManagerIdentity] = repo;
    anno[AnnoKeySourcePath] = provisioningPreview.ref ? path + '#' + provisioningPreview.ref : path;

    return {
      meta: {
        canStar: false,
        isSnapshot: false,
        canShare: false,

        // Should come from the repo settings
        canDelete: true,
        canSave: true,
        canEdit: true,

        // Includes additional k8s metadata
        k8s: dryRun.metadata,

        // lookup info
        provisioning: provisioningPreview,
      },
      dashboard: dryRun.spec,
    };
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

      this.setState({ dashboard: dashboard, isLoading: false });
      const measure = stopMeasure(LOAD_SCENE_MEASUREMENT);
      const queryController = sceneGraph.getQueryController(dashboard);

      trackDashboardSceneLoaded(dashboard, measure?.duration);
      queryController?.startProfile('dashboard_view');

      if (options.route !== DashboardRoutes.New) {
        emitDashboardViewEvent({
          meta: dashboard.state.meta,
          uid: dashboard.state.uid,
          title: dashboard.state.title,
          id: dashboard.state.id,
        });
      }
    } catch (err) {
      const status = getStatusFromError(err);
      const message = getMessageFromError(err);
      const messageId = getMessageIdFromError(err);

      this.setState({
        isLoading: false,
        loadError: {
          status,
          message,
          messageId,
        },
      });

      if (!isFetchError(err)) {
        console.error('Error loading dashboard:', err);
      }

      // If the error is a DashboardVersionError, we want to throw it so that the error boundary is triggered
      // This enables us to switch to the correct version of the dashboard
      if (err instanceof DashboardVersionError) {
        throw err;
      }
    }
  }

  private async loadScene(options: LoadDashboardOptions): Promise<DashboardScene | null> {
    this.setState({ dashboard: undefined, isLoading: true });

    // Home dashboard is not handled through legacy API and is not versioned.
    // Handling home dashboard flow separately from regular dashboard flow.
    if (options.route === DashboardRoutes.Home) {
      return await this.loadHomeDashboard();
    }

    const rsp = await this.fetchDashboard(options);

    if (!rsp) {
      return null;
    }

    return this.transformResponseToScene(rsp, options);
  }

  public getDashboardFromCache(cacheKey: string): T | null {
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

  public setDashboardCache(cacheKey: string, dashboard: T) {
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

  public removeSceneCache(cacheKey: string) {
    delete this.cache[cacheKey];
  }

  public clearSceneCache() {
    this.cache = {};
  }
}

export class DashboardScenePageStateManager extends DashboardScenePageStateManagerBase<DashboardDTO> {
  transformResponseToScene(rsp: DashboardDTO | null, options: LoadDashboardOptions): DashboardScene | null {
    const fromCache = this.getSceneFromCache(options.uid);

    if (
      fromCache &&
      fromCache.state.version === rsp?.dashboard.version &&
      fromCache.state.meta.created === rsp?.meta.created
    ) {
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

    throw new Error('Dashboard not found');
  }

  public async loadSnapshotScene(slug: string): Promise<DashboardScene> {
    const rsp = await dashboardLoaderSrv.loadSnapshot(slug);

    if (rsp?.dashboard) {
      if (isDashboardV2Spec(rsp.dashboard)) {
        throw new DashboardVersionError('v2beta1', 'Using legacy snapshot API to get a V2 dashboard');
      }

      const scene = transformSaveModelToScene(rsp);
      return scene;
    }

    throw new Error('Snapshot not found');
  }

  public async fetchDashboard({
    type,
    slug,
    uid,
    route,
    urlFolderUid,
  }: LoadDashboardOptions): Promise<DashboardDTO | null> {
    const cacheKey = route === DashboardRoutes.Home ? HOME_DASHBOARD_CACHE_KEY : uid;

    const cachedDashboard = this.getDashboardFromCache(cacheKey);

    if (cachedDashboard) {
      return cachedDashboard;
    }

    let rsp: DashboardDTO;

    try {
      switch (route) {
        case DashboardRoutes.Home:
          // For legacy dashboarding we keep this logic here, as dashboard can be loaded through state manager's fetchDashboard method directly
          // See DashboardPageProxy.
          const homeDashboard = await this.fetchHomeDashboard();

          if (!homeDashboard) {
            return null;
          }

          rsp = homeDashboard;
          break;
        case DashboardRoutes.New:
          rsp = await buildNewDashboardSaveModel(urlFolderUid);
          break;
        case DashboardRoutes.Provisioning:
          return this.loadProvisioningDashboard(slug || '', uid);
        case DashboardRoutes.Public: {
          const result = await dashboardLoaderSrv.loadDashboard('public', '', uid);
          // public dashboards use legacy API but can return V2 dashboards
          // in this case we need to throw a dashboard version error so that the call can be delegated
          // to V2 state manager which will run fetchDashboard
          if (isDashboardV2Spec(result.dashboard)) {
            throw new DashboardVersionError('v2beta1', 'Using legacy public dashboard API to get a V2 dashboard');
          }
          return result;
        }
        default:
          // If reloadDashboardsOnParamsChange is on, we need to process query params for dashboard load
          // Since the scene is not yet there, we need to process whatever came through URL
          if (config.featureToggles.reloadDashboardsOnParamsChange) {
            const queryParamsObject = processQueryParamsForDashboardLoad();
            rsp = await dashboardLoaderSrv.loadDashboard(type || 'db', slug || '', uid, queryParamsObject);
          } else {
            rsp = await dashboardLoaderSrv.loadDashboard(type || 'db', slug || '', uid);
          }

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

  public async reloadDashboard(queryParams: UrlQueryMap): Promise<void> {
    const dashboard = this.state.dashboard;

    if (!dashboard || !dashboard.state.uid) {
      return;
    }

    const uid = dashboard.state.uid;

    try {
      this.setState({ isLoading: true });

      const rsp = await dashboardLoaderSrv.loadDashboard('db', dashboard.state.meta.slug, uid, queryParams);
      const fromCache = this.getSceneFromCache(uid);

      // check if cached db version is same as both
      // response and current db state. There are scenarios where they can differ
      // e.g: when reloadOnParamsChange ff is on the first loaded dashboard could be version 0
      // then on this reload call the rsp increments the version. When the cache is not set
      // it creates a new scene based on the new rsp. But if we navigate to another dashboard
      // and then back to the initial one, the cache is still set, but the dashboard will be loaded
      // again with version 0. Because the cache is set with the incremented version and the rsp on
      // reload will match the cached version we return and do nothing, but the set scene is still
      // the one for the version 0 dashboard, thus we verify dashboard state version as well
      if (
        fromCache &&
        fromCache.state.version === rsp?.dashboard.version &&
        fromCache.state.version === this.state.dashboard?.state.version
      ) {
        this.setState({ isLoading: false });
        return;
      }

      if (!rsp?.dashboard) {
        this.setState({
          isLoading: false,
          loadError: {
            status: 404,
            message: t(
              'dashboard-scene.dashboard-scene-page-state-manager.message.dashboard-not-found',
              'Dashboard not found'
            ),
          },
        });
        return;
      }

      const scene = transformSaveModelToScene(rsp);

      // we need to call and restore dashboard state on every reload that pulls a new dashboard version
      if (config.featureToggles.preserveDashboardStateWhenNavigating && Boolean(uid)) {
        restoreDashboardStateFromLocalStorage(scene);
      }

      this.setSceneCache(uid, scene);
      this.setState({ dashboard: scene, isLoading: false });
    } catch (err) {
      const status = getStatusFromError(err);
      const message = getMessageFromError(err);

      this.setState({
        isLoading: false,
        loadError: {
          message,
          status,
        },
      });

      if (err instanceof DashboardVersionError) {
        throw err;
      }
    }
  }
}

export class DashboardScenePageStateManagerV2 extends DashboardScenePageStateManagerBase<
  DashboardWithAccessInfo<DashboardV2Spec>
> {
  private dashboardLoader = new DashboardLoaderSrvV2();

  public async loadSnapshotScene(slug: string): Promise<DashboardScene> {
    const rsp = await this.dashboardLoader.loadSnapshot(slug);
    const v2Response = ensureV2Response(rsp);

    if (v2Response.spec) {
      const scene = transformSaveModelSchemaV2ToScene(v2Response);
      return scene;
    }

    throw new Error('Snapshot not found');
  }

  transformResponseToScene(
    rsp: DashboardWithAccessInfo<DashboardV2Spec> | null,
    options: LoadDashboardOptions
  ): DashboardScene | null {
    const fromCache = this.getSceneFromCache(options.uid);

    if (fromCache && fromCache.state.version === rsp?.metadata.generation) {
      return fromCache;
    }

    if (rsp) {
      const scene = transformSaveModelSchemaV2ToScene(rsp);

      // Cache scene only if not coming from Explore, we don't want to cache temporary dashboard
      if (options.uid) {
        this.setSceneCache(options.uid, scene);
      }

      return scene;
    }

    throw new Error('Dashboard not found');
  }

  public async fetchDashboard({
    type,
    slug,
    uid,
    route,
    urlFolderUid,
  }: LoadDashboardOptions): Promise<DashboardWithAccessInfo<DashboardV2Spec> | null> {
    const cacheKey = route === DashboardRoutes.Home ? HOME_DASHBOARD_CACHE_KEY : uid;

    const cachedDashboard = this.getDashboardFromCache(cacheKey);
    if (cachedDashboard) {
      return cachedDashboard;
    }

    let rsp: DashboardWithAccessInfo<DashboardV2Spec>;
    try {
      switch (route) {
        case DashboardRoutes.New:
          rsp = await buildNewDashboardSaveModelV2(urlFolderUid);
          break;
        case DashboardRoutes.Provisioning: {
          return await this.loadProvisioningDashboard(slug || '', uid);
        }
        case DashboardRoutes.Public: {
          return await this.dashboardLoader.loadDashboard('public', '', uid);
        }
        default:
          rsp = await this.dashboardLoader.loadDashboard(type || 'db', slug || '', uid);

          if (route === DashboardRoutes.Embedded) {
            rsp.metadata.annotations = rsp.metadata.annotations || {};
            rsp.metadata.annotations[AnnoKeyEmbedded] = 'embedded';
          }
      }
      if (rsp.access.url && route === DashboardRoutes.Normal) {
        const dashboardUrl = locationUtil.stripBaseFromUrl(rsp.access.url);
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
      if (rsp.metadata.annotations?.[AnnoKeyFolder]) {
        await updateNavModel(rsp.metadata.annotations?.[AnnoKeyFolder]);
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

  public async reloadDashboard(queryParams: UrlQueryMap): Promise<void> {
    const dashboard = this.state.dashboard;

    if (!dashboard || !dashboard.state.uid) {
      return;
    }

    const uid = dashboard.state.uid;

    try {
      this.setState({ isLoading: true });

      const rsp = await this.dashboardLoader.loadDashboard('db', dashboard.state.meta.slug, uid, queryParams);
      const fromCache = this.getSceneFromCache(uid);

      if (
        fromCache &&
        fromCache.state.version === rsp?.metadata.generation &&
        fromCache.state.version === this.state.dashboard?.state.version
      ) {
        this.setState({ isLoading: false });
        return;
      }

      if (!rsp?.spec) {
        this.setState({
          isLoading: false,
          loadError: {
            status: 404,
            message: t(
              'dashboard-scene.dashboard-scene-page-state-manager-v2.message.dashboard-not-found',
              'Dashboard not found'
            ),
          },
        });
        return;
      }

      const scene = transformSaveModelSchemaV2ToScene(rsp);

      // we need to call and restore dashboard state on every reload that pulls a new dashboard version
      if (config.featureToggles.preserveDashboardStateWhenNavigating && Boolean(uid)) {
        restoreDashboardStateFromLocalStorage(scene);
      }

      this.setSceneCache(uid, scene);

      this.setState({ dashboard: scene, isLoading: false });
    } catch (err) {
      const status = getStatusFromError(err);
      const message = getMessageFromError(err);
      this.setState({
        isLoading: false,
        loadError: {
          message,
          status,
        },
      });
      if (err instanceof DashboardVersionError) {
        throw err;
      }
    }
  }
}

export class UnifiedDashboardScenePageStateManager extends DashboardScenePageStateManagerBase<
  DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>
> {
  private v1Manager: DashboardScenePageStateManager;
  private v2Manager: DashboardScenePageStateManagerV2;
  private activeManager: DashboardScenePageStateManager | DashboardScenePageStateManagerV2;

  constructor(initialState: Partial<DashboardScenePageState>) {
    super(initialState);
    this.v1Manager = new DashboardScenePageStateManager(initialState);
    this.v2Manager = new DashboardScenePageStateManagerV2(initialState);

    this.activeManager = this.v1Manager;
  }

  private async withVersionHandling<T>(
    operation: (manager: DashboardScenePageStateManager | DashboardScenePageStateManagerV2) => Promise<T>
  ): Promise<T> {
    try {
      return await operation(this.activeManager);
    } catch (error) {
      if (error instanceof DashboardVersionError) {
        const manager = isV2StoredVersion(error.data.storedVersion) ? this.v2Manager : this.v1Manager;
        this.activeManager = manager;
        return await operation(manager);
      } else {
        throw error;
      }
    } finally {
      // need to sync the state of the active manager with the unified manager
      // in cases when components are subscribed to unified manager's state
      this.setState(this.activeManager.state);
    }
  }

  public async fetchDashboard(options: LoadDashboardOptions) {
    return this.withVersionHandling<DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec> | null>((manager) =>
      manager.fetchDashboard(options)
    );
  }

  public async reloadDashboard(queryParams: UrlQueryMap) {
    return this.withVersionHandling((manager) => manager.reloadDashboard.call(this, queryParams));
  }

  public getDashboardFromCache(uid: string) {
    return this.activeManager.getDashboardFromCache(uid);
  }

  transformResponseToScene(
    rsp: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec> | null,
    options: LoadDashboardOptions
  ): DashboardScene | null {
    if (!rsp) {
      return null;
    }
    if (isDashboardV2Resource(rsp)) {
      this.activeManager = this.v2Manager;
      return this.v2Manager.transformResponseToScene(rsp, options);
    }

    return this.v1Manager.transformResponseToScene(rsp, options);
  }

  public async loadSnapshotScene(slug: string): Promise<DashboardScene> {
    try {
      return await this.v1Manager.loadSnapshotScene(slug);
    } catch (error) {
      if (error instanceof DashboardVersionError && isV2StoredVersion(error.data.storedVersion)) {
        return await this.v2Manager.loadSnapshotScene(slug);
      }
      throw new Error('Snapshot not found');
    }
  }

  public async loadSnapshot(slug: string) {
    return this.withVersionHandling((manager) => manager.loadSnapshot.call(this, slug));
  }

  public clearDashboardCache() {
    this.v1Manager.clearDashboardCache();
    this.v2Manager.clearDashboardCache();
  }

  public clearSceneCache() {
    this.v1Manager.clearSceneCache();
    this.v2Manager.clearSceneCache();
    this.cache = {};
  }

  public getSceneFromCache(key: string) {
    return this.activeManager.getSceneFromCache(key);
  }

  public setSceneCache(cacheKey: string, scene: DashboardScene): void {
    this.activeManager.setSceneCache(cacheKey, scene);
  }

  public removeSceneCache(cacheKey: string): void {
    this.v1Manager.removeSceneCache(cacheKey);
    this.v2Manager.removeSceneCache(cacheKey);
  }

  public getCache() {
    return this.activeManager.getCache();
  }

  public setDashboardCache(cacheKey: string, dashboard: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>) {
    if (isDashboardV2Resource(dashboard)) {
      this.v2Manager.setDashboardCache(cacheKey, dashboard);
    } else {
      this.v1Manager.setDashboardCache(cacheKey, dashboard);
    }
  }

  public async loadDashboard(options: LoadDashboardOptions): Promise<void> {
    if (options.route === DashboardRoutes.New) {
      const newDashboardVersion = config.featureToggles.dashboardNewLayouts ? 'v2' : 'v1';
      this.setActiveManager(newDashboardVersion);
    }
    return this.withVersionHandling((manager) => manager.loadDashboard.call(this, options));
  }

  public setActiveManager(manager: 'v1' | 'v2') {
    if (manager === 'v1') {
      this.activeManager = this.v1Manager;
    } else {
      this.activeManager = this.v2Manager;
    }
  }
  public resetActiveManager() {
    this.setActiveManager('v1');
  }
}

const managers: {
  v1?: DashboardScenePageStateManager;
  v2?: DashboardScenePageStateManagerV2;
  unified?: UnifiedDashboardScenePageStateManager;
} = {
  v1: undefined,
  v2: undefined,
  unified: undefined,
};

export function getDashboardScenePageStateManager(): UnifiedDashboardScenePageStateManager;
export function getDashboardScenePageStateManager(v: 'v1'): DashboardScenePageStateManager;
export function getDashboardScenePageStateManager(v: 'v2'): DashboardScenePageStateManagerV2;

export function getDashboardScenePageStateManager(v?: 'v1' | 'v2') {
  if (v === 'v1') {
    if (!managers.v1) {
      managers.v1 = new DashboardScenePageStateManager({});
    }
    return managers.v1;
  }

  if (v === 'v2') {
    if (!managers.v2) {
      managers.v2 = new DashboardScenePageStateManagerV2({});
    }
    return managers.v2;
  }

  if (!managers.unified) {
    managers.unified = new UnifiedDashboardScenePageStateManager({});
  }

  return managers.unified;
}
