import $ from 'jquery';
import _, { isFunction } from 'lodash'; // eslint-disable-line lodash/import-scope
import moment from 'moment'; // eslint-disable-line no-restricted-imports

import { AppEvents, dateMath, UrlQueryMap, UrlQueryValue } from '@grafana/data';
import { getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { BASE_URL } from 'app/api/clients/provisioning/baseAPI';
import { backendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import kbn from 'app/core/utils/kbn';
import { AnnoKeyManagerKind, AnnoKeyManagerIdentity, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ProvisioningPreview } from 'app/features/provisioning/types';
import { DashboardDTO } from 'app/types';

import { appEvents } from '../../../core/core';
import { ResponseTransformers } from '../api/ResponseTransformers';
import { getDashboardAPI } from '../api/dashboard_api';
import { DashboardVersionError, DashboardWithAccessInfo } from '../api/types';

import { getDashboardSrv } from './DashboardSrv';
import { getDashboardSnapshotSrv } from './SnapshotSrv';

interface DashboardLoaderSrvLike<T> {
  loadDashboard(
    type: UrlQueryValue,
    slug: string | undefined,
    uid: string | undefined,
    params?: UrlQueryMap
  ): Promise<T>;
}

abstract class DashboardLoaderSrvBase<T> implements DashboardLoaderSrvLike<T> {
  abstract loadDashboard(
    type: UrlQueryValue,
    slug: string | undefined,
    uid: string | undefined,
    params?: UrlQueryMap
  ): Promise<T>;

  abstract loadSnapshot(slug: string): Promise<T>;

  protected abstract isVersionSupported(version: string): boolean;
  protected abstract processDashboardFromProvisioning(
    repo: string,
    path: string,
    dryRun: any,
    provisioningPreview: ProvisioningPreview
  ): T;

  protected loadScriptedDashboard(file: string) {
    const url = 'public/dashboards/' + file.replace(/\.(?!js)/, '/') + '?' + new Date().getTime();

    return getBackendSrv()
      .get(url)
      .then(this.executeScript.bind(this))
      .then(
        (result: any) => {
          return {
            meta: {
              fromScript: true,
              canDelete: false,
              canSave: false,
              canStar: false,
            },
            dashboard: result.data,
          };
        },
        (err) => {
          console.error('Script dashboard error ' + err);
          appEvents.emit(AppEvents.alertError, [
            'Script Error',
            'Please make sure it exists and returns a valid dashboard',
          ]);
          throw err;
        }
      );
  }

  private executeScript(result: any) {
    const services = {
      dashboardSrv: getDashboardSrv(),
      datasourceSrv: getDatasourceSrv(),
    };
    const scriptFunc = new Function(
      'ARGS',
      'kbn',
      'dateMath',
      '_',
      'moment',
      'window',
      'document',
      '$',
      'jQuery',
      'services',
      result
    );
    const scriptResult = scriptFunc(
      locationService.getSearchObject(),
      kbn,
      dateMath,
      _,
      moment,
      window,
      document,
      $,
      $,
      services
    );

    // Handle async dashboard scripts
    if (isFunction(scriptResult)) {
      return new Promise((resolve) => {
        scriptResult((dashboard: any) => {
          resolve({ data: dashboard });
        });
      });
    }

    return { data: scriptResult };
  }

  protected loadDashboardFromProvisioning(repo: string, path: string) {
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
        if (!this.isVersionSupported(dryRun.apiVersion.split('/')[1])) {
          throw new DashboardVersionError(dryRun.apiVersion.split('/')[1], 'Unsupported dashboard version');
        }

        return this.processDashboardFromProvisioning(repo, path, dryRun, {
          file: url,
          ref: ref,
          repo: repo,
        });
      });
  }
}

export class DashboardLoaderSrv extends DashboardLoaderSrvBase<DashboardDTO> {
  private SUPPORTED_VERSIONS = ['v1alpha1', 'v0alpha1'];

  protected isVersionSupported(version: string): boolean {
    return this.SUPPORTED_VERSIONS.includes(version);
  }

  loadDashboard(
    type: UrlQueryValue,
    slug: string | undefined,
    uid: string | undefined,
    params?: UrlQueryMap
  ): Promise<DashboardDTO> {
    const stateManager = getDashboardScenePageStateManager('v1');
    let promise;

    if (type === 'script' && slug) {
      promise = this.loadScriptedDashboard(slug);
    } else if (type === 'provisioning' && uid && slug) {
      promise = this.loadDashboardFromProvisioning(slug, uid);
      // needed for the old architecture
      // in scenes this is handled through loadSnapshot method
    } else if (type === 'snapshot' && slug) {
      promise = getDashboardSnapshotSrv().getSnapshot(slug);
    } else if (type === 'public' && uid) {
      promise = backendSrv.getPublicDashboardByUid(uid).then((result) => {
        return result;
      });
    } else if (uid) {
      if (!params) {
        const cachedDashboard = stateManager.getDashboardFromCache(uid);
        if (cachedDashboard) {
          return Promise.resolve(cachedDashboard);
        }
      }

      promise = getDashboardAPI('v1')
        .getDashboardDTO(uid, params)
        .then((result) => {
          return result;
        })
        .catch((e) => {
          if (isFetchError(e) && !(e instanceof DashboardVersionError)) {
            console.error('Failed to load dashboard', e);
            e.isHandled = true;
            if (e.status === 404) {
              appEvents.emit(AppEvents.alertError, ['Dashboard not found']);
            }
          }

          throw e;
        });
    } else {
      throw new Error('Dashboard uid or slug required');
    }

    promise.then((result: DashboardDTO) => {
      impressionSrv.addDashboardImpression(result.dashboard.uid);

      return result;
    });

    return promise;
  }

  loadSnapshot(slug: string): Promise<DashboardDTO> {
    const promise = getDashboardSnapshotSrv().getSnapshot(slug);

    promise.then((result: DashboardDTO) => {
      impressionSrv.addDashboardImpression(result.dashboard.uid);

      return result;
    });

    return promise;
  }

  protected processDashboardFromProvisioning(
    repo: string,
    path: string,
    dryRun: any,
    provisioningPreview: ProvisioningPreview
  ): DashboardDTO {
    // Make sure the annotation key exists
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
}

export class DashboardLoaderSrvV2 extends DashboardLoaderSrvBase<DashboardWithAccessInfo<DashboardV2Spec>> {
  private SUPPORTED_VERSIONS = ['v2alpha1'];

  protected isVersionSupported(version: string): boolean {
    return this.SUPPORTED_VERSIONS.includes(version);
  }

  loadDashboard(
    type: UrlQueryValue,
    slug: string | undefined,
    uid: string | undefined,
    params?: UrlQueryMap
  ): Promise<DashboardWithAccessInfo<DashboardV2Spec>> {
    const stateManager = getDashboardScenePageStateManager('v2');
    let promise;

    if (type === 'script' && slug) {
      promise = this.loadScriptedDashboard(slug).then((r) => ResponseTransformers.ensureV2Response(r));
    } else if (type === 'public' && uid) {
      promise = backendSrv.getPublicDashboardByUid(uid).then((result) => {
        return ResponseTransformers.ensureV2Response(result);
      });
    } else if (type === 'provisioning' && uid && slug) {
      promise = this.loadDashboardFromProvisioning(slug, uid);
    } else if (uid) {
      if (!params) {
        const cachedDashboard = stateManager.getDashboardFromCache(uid);
        if (cachedDashboard) {
          return Promise.resolve(cachedDashboard);
        }
      }

      promise = getDashboardAPI('v2')
        .getDashboardDTO(uid, params)
        .then((result) => {
          return result;
        })
        .catch((e) => {
          if (isFetchError(e) && !(e instanceof DashboardVersionError)) {
            console.error('Failed to load dashboard', e);
            e.isHandled = true;
            if (e.status === 404) {
              appEvents.emit(AppEvents.alertError, ['Dashboard not found']);
            }
          }

          throw e;
        });
    } else {
      throw new Error('Dashboard uid or slug required');
    }

    promise.then((result: DashboardWithAccessInfo<DashboardV2Spec>) => {
      impressionSrv.addDashboardImpression(result.metadata.name);
      return result;
    });

    return promise;
  }

  loadSnapshot(slug: string): Promise<DashboardWithAccessInfo<DashboardV2Spec>> {
    const promise = getDashboardSnapshotSrv()
      .getSnapshot(slug)
      .then((r) => ResponseTransformers.ensureV2Response(r));

    promise.then((result: DashboardWithAccessInfo<DashboardV2Spec>) => {
      impressionSrv.addDashboardImpression(result.metadata.name);

      return result;
    });

    return promise;
  }

  protected processDashboardFromProvisioning(
    _repo: string,
    _path: string,
    dryRun: any,
    _provisioningPreview: ProvisioningPreview
  ): DashboardWithAccessInfo<DashboardV2Spec> {
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
}

let dashboardLoaderSrv = new DashboardLoaderSrv();
export { dashboardLoaderSrv };

/** @internal
 * Used for tests only
 */
export const setDashboardLoaderSrv = (srv: DashboardLoaderSrv) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('dashboardLoaderSrv can be only overriden in test environment');
  }

  dashboardLoaderSrv = srv;
};
