import $ from 'jquery';
import _, { isFunction } from 'lodash'; // eslint-disable-line lodash/import-scope
import moment from 'moment'; // eslint-disable-line no-restricted-imports

import { AppEvents, dateMath, UrlQueryMap, UrlQueryValue } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import kbn from 'app/core/utils/kbn';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DashboardDTO } from 'app/types';

import { appEvents } from '../../../core/core';
import { getDashboardAPI } from '../api/dashboard_api';

import { getDashboardSrv } from './DashboardSrv';
import { getDashboardSnapshotSrv } from './SnapshotSrv';

export class DashboardLoaderSrv {
  constructor() {}
  _dashboardLoadFailed(title: string, snapshot?: boolean): DashboardDTO {
    snapshot = snapshot || false;
    return {
      meta: {
        canStar: false,
        isSnapshot: snapshot,
        canDelete: false,
        canSave: false,
        canEdit: false,
        canShare: false,
        dashboardNotFound: true,
      },
      dashboard: { title, uid: title, schemaVersion: 0 },
    };
  }

  loadDashboard(
    type: UrlQueryValue,
    slug: string | undefined,
    uid: string | undefined,
    params?: UrlQueryMap
  ): Promise<DashboardDTO> {
    const stateManager = getDashboardScenePageStateManager();
    let promise;

    if (type === 'script' && slug) {
      promise = this._loadScriptedDashboard(slug);
    } else if (type === 'snapshot' && slug) {
      promise = getDashboardSnapshotSrv()
        .getSnapshot(slug)
        .catch(() => {
          return this._dashboardLoadFailed('Snapshot not found', true);
        });
    } else if (type === 'public' && uid) {
      promise = backendSrv
        .getPublicDashboardByUid(uid)
        .then((result) => {
          return result;
        })
        .catch((e) => {
          const isPublicDashboardPaused =
            e.data.statusCode === 403 && e.data.messageId === 'publicdashboards.notEnabled';
          const isPublicDashboardNotFound =
            e.data.statusCode === 404 && e.data.messageId === 'publicdashboards.notFound';
          const isDashboardNotFound =
            e.data.statusCode === 404 && e.data.messageId === 'publicdashboards.dashboardNotFound';

          const dashboardModel = this._dashboardLoadFailed(
            isPublicDashboardPaused ? 'Public Dashboard paused' : 'Public Dashboard Not found',
            true
          );
          return {
            ...dashboardModel,
            meta: {
              ...dashboardModel.meta,
              publicDashboardEnabled: isPublicDashboardNotFound ? undefined : !isPublicDashboardPaused,
              dashboardNotFound: isPublicDashboardNotFound || isDashboardNotFound,
            },
          };
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
        .then((result) => {
          if (result.meta.isFolder) {
            appEvents.emit(AppEvents.alertError, ['Dashboard not found']);
            throw new Error('Dashboard not found');
          }
          return result;
        })
        .catch(() => {
          const dash = this._dashboardLoadFailed('Not found', true);
          dash.dashboard.uid = uid;
          return dash;
        });
    } else {
      throw new Error('Dashboard uid or slug required');
    }

    promise.then((result: DashboardDTO) => {
      if (result.meta.dashboardNotFound !== true) {
        impressionSrv.addDashboardImpression(result.dashboard.uid);
      }

      return result;
    });

    return promise;
  }

  _loadScriptedDashboard(file: string) {
    const url = 'public/dashboards/' + file.replace(/\.(?!js)/, '/') + '?' + new Date().getTime();

    return getBackendSrv()
      .get(url)
      .then(this._executeScript.bind(this))
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
          return this._dashboardLoadFailed('Scripted dashboard');
        }
      );
  }

  _executeScript(result: any) {
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
