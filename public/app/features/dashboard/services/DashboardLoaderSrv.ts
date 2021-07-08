import moment from 'moment'; // eslint-disable-line no-restricted-imports
// eslint-disable-next-line lodash/import-scope
import _, { isFunction } from 'lodash';
import $ from 'jquery';
import kbn from 'app/core/utils/kbn';
import { AppEvents, dateMath, UrlQueryValue } from '@grafana/data';
import impressionSrv from 'app/core/services/impression_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from './DashboardSrv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { appEvents } from '../../../core/core';

export class DashboardLoaderSrv {
  constructor() {}
  _dashboardLoadFailed(title: string, snapshot?: boolean) {
    snapshot = snapshot || false;
    return {
      meta: {
        canStar: false,
        isSnapshot: snapshot,
        canDelete: false,
        canSave: false,
        canEdit: false,
        dashboardNotFound: true,
      },
      dashboard: { title },
    };
  }

  loadDashboard(type: UrlQueryValue, slug: any, uid: any) {
    let promise;

    if (type === 'script') {
      promise = this._loadScriptedDashboard(slug);
    } else if (type === 'snapshot') {
      promise = backendSrv.get('/api/snapshots/' + slug).catch(() => {
        return this._dashboardLoadFailed('Snapshot not found', true);
      });
    } else if (type === 'ds') {
      promise = this._loadFromDatasource(slug); // explore dashboards as code
    } else {
      promise = backendSrv
        .getDashboardByUid(uid)
        .then((result: any) => {
          if (result.meta.isFolder) {
            appEvents.emit(AppEvents.alertError, ['Dashboard not found']);
            throw new Error('Dashboard not found');
          }
          return result;
        })
        .catch(() => {
          return this._dashboardLoadFailed('Not found', true);
        });
    }

    promise.then((result: any) => {
      if (result.meta.dashboardNotFound !== true) {
        impressionSrv.addDashboardImpression(result.dashboard.id);
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
        (err: any) => {
          console.error('Script dashboard error ' + err);
          appEvents.emit(AppEvents.alertError, [
            'Script Error',
            'Please make sure it exists and returns a valid dashboard',
          ]);
          return this._dashboardLoadFailed('Scripted dashboard');
        }
      );
  }

  /**
   * This is a temporary solution to load dashboards dynamically from a datasource
   * Eventually this should become a plugin type or a special handler in the dashboard
   * loading code
   */
  async _loadFromDatasource(dsid: string) {
    const ds = await getDatasourceSrv().get(dsid);
    if (!ds) {
      return Promise.reject('can not find datasource: ' + dsid);
    }

    const params = new URLSearchParams(window.location.search);
    const path = params.get('path');
    if (!path) {
      return Promise.reject('expecting path parameter');
    }

    const queryParams: { [key: string]: any } = {};

    params.forEach((value, key) => {
      queryParams[key] = value;
    });

    return getBackendSrv()
      .get(`/api/datasources/${ds.id}/resources/${path}`, queryParams)
      .then((data) => {
        return {
          meta: {
            fromScript: true,
            canDelete: false,
            canSave: false,
            canStar: false,
          },
          dashboard: data,
        };
      });
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
