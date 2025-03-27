import $ from 'jquery';
import _, { isFunction } from 'lodash'; // eslint-disable-line lodash/import-scope
import moment from 'moment'; // eslint-disable-line no-restricted-imports

import { AppEvents, dateMath, UrlQueryMap, UrlQueryValue } from '@grafana/data';
import { getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { backendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import kbn from 'app/core/utils/kbn';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DashboardDTO } from 'app/types';

import { appEvents } from '../../../core/core';
import { ResponseTransformers } from '../api/ResponseTransformers';
import { getDashboardAPI } from '../api/dashboard_api';
import { DashboardWithAccessInfo } from '../api/types';

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
}

export class DashboardLoaderSrv extends DashboardLoaderSrvBase<DashboardDTO> {
  loadDashboard(
    type: UrlQueryValue,
    slug: string | undefined,
    uid: string | undefined,
    params?: UrlQueryMap
  ): Promise<DashboardDTO> {
    const stateManager = getDashboardScenePageStateManager();
    let promise;

    if (type === 'script' && slug) {
      promise = this.loadScriptedDashboard(slug);
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

      promise = getDashboardAPI()
        .getDashboardDTO(uid, params)
        .catch((e) => {
          console.error('Failed to load dashboard', e);
          if (isFetchError(e)) {
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
}

export class DashboardLoaderSrvV2 extends DashboardLoaderSrvBase<DashboardWithAccessInfo<DashboardV2Spec>> {
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
    } else if (uid) {
      if (!params) {
        const cachedDashboard = stateManager.getDashboardFromCache(uid);
        if (cachedDashboard) {
          return Promise.resolve(cachedDashboard);
        }
      }

      promise = getDashboardAPI('v2')
        .getDashboardDTO(uid, params)
        .catch((e) => {
          console.error('Failed to load dashboard', e);
          if (isFetchError(e)) {
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
