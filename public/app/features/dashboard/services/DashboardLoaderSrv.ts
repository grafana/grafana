import $ from 'jquery';
import _, { isFunction } from 'lodash'; // eslint-disable-line lodash/import-scope
import moment from 'moment'; // eslint-disable-line no-restricted-imports

import { AppEvents, dateMath, UrlQueryMap, UrlQueryValue } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { backendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import kbn from 'app/core/utils/kbn';
import { AnnoKeyDashboardNotFound, AnnoKeyFromScript, AnnoKeyIsSnapshot, AnnoKeyPublicDashboardEnabled } from 'app/features/apiserver/types';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DashboardDataDTO } from 'app/types';

import { appEvents } from '../../../core/core';
import { ResponseTransformers } from '../api/ResponseTransformers';
import { getDashboardAPI } from '../api/dashboard_api';
import { DashboardWithAccessInfo } from '../api/types';

import { getDashboardSrv } from './DashboardSrv';
import { getDashboardSnapshotSrv } from './SnapshotSrv';

export class DashboardLoaderSrv {
  constructor() {}
  _dashboardLoadFailed(title: string, snapshot?: boolean): DashboardWithAccessInfo<DashboardDataDTO> {
    snapshot = snapshot || false;
    return {
      apiVersion: 'legacy',
      kind: 'DashboardWithAccessInfo',
      access: {
        canStar: false,
        canDelete: false,
        canSave: false,
        canEdit: false,
        canShare: false
      },
      metadata: {
        annotations: {
          [AnnoKeyIsSnapshot]: snapshot,
          [AnnoKeyDashboardNotFound]: true
        },
        creationTimestamp: '',
        name: title,
        resourceVersion: '0',
        // dashboardNotFound: true,
      },
      spec: { title, uid: title, schemaVersion: 0 },
    };
  }

  loadDashboard(
    type: UrlQueryValue,
    slug: string | undefined,
    uid: string | undefined,
    params?: UrlQueryMap
  ): Promise<DashboardWithAccessInfo<DashboardV2Spec | DashboardDataDTO>> {
    const stateManager = getDashboardScenePageStateManager();
    let promise: Promise<DashboardWithAccessInfo<DashboardV2Spec | DashboardDataDTO>>;

    if (type === 'script' && slug) {
      promise = this._loadScriptedDashboard(slug);
    } else if (type === 'snapshot' && slug) {
      promise = getDashboardSnapshotSrv()
        .getSnapshot(slug)
        .then((result) => {
          return ResponseTransformers.transformDashboardDTOToDashboardWithAccessInfo(result);
        })
        .catch(() => {
          return this._dashboardLoadFailed('Snapshot not found', true);
        });
    } else if (type === 'public' && uid) {
      promise = backendSrv
        .getPublicDashboardByUid(uid)
        .then((result) => {
          return ResponseTransformers.transformDashboardDTOToDashboardWithAccessInfo(result);
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

          if(dashboardModel.metadata.annotations){  
            dashboardModel.metadata.annotations[AnnoKeyDashboardNotFound] = isPublicDashboardNotFound || isDashboardNotFound;
            dashboardModel.metadata.annotations[AnnoKeyPublicDashboardEnabled] = isPublicDashboardNotFound ? undefined : !isPublicDashboardPaused;
          } else {
            dashboardModel.metadata.annotations = {
              [AnnoKeyDashboardNotFound]: isPublicDashboardNotFound || isDashboardNotFound,
              [AnnoKeyPublicDashboardEnabled]: isPublicDashboardNotFound ? undefined : !isPublicDashboardPaused, 
            }
          }

          return dashboardModel

          // return {
          //   ...dashboardModel,
          //   meta: {
          //     ...dashboardModel.meta,
          //     publicDashboardEnabled: isPublicDashboardNotFound ? undefined : !isPublicDashboardPaused,
          //     dashboardNotFound: isPublicDashboardNotFound || isDashboardNotFound,
          //   },
          // };
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
        .catch(() => {
          const dash = this._dashboardLoadFailed('Not found', true);
          dash.metadata.name = '';
          return dash;
        });
    } else {
      throw new Error('Dashboard uid or slug required');
    }

    promise.then((result) => {
      impressionSrv.addDashboardImpression(result);

      return result;
    });

    return promise;
  }

  _loadScriptedDashboard(file: string): Promise<DashboardWithAccessInfo<DashboardDataDTO>> {
    const url = 'public/dashboards/' + file.replace(/\.(?!js)/, '/') + '?' + new Date().getTime();

    return getBackendSrv()
      .get(url)
      .then(this._executeScript.bind(this))
      .then(
        (result: any) => {

          const dashboard = ResponseTransformers.transformDashboardDTOToDashboardWithAccessInfo(result)

          dashboard.access.canDelete = false;
          dashboard.access.canSave = false;
          dashboard.access.canStar = false;

          if(dashboard.metadata.annotations){
            dashboard.metadata.annotations[AnnoKeyFromScript] = true;
          } else {
            dashboard.metadata.annotations = {
              [AnnoKeyFromScript]: true
            }
          }
          return dashboard
          
          // return {
          //   meta: {
          //     fromScript: true,
          //     canDelete: false,
          //     canSave: false,
          //     canStar: false,
          //   },
          //   dashboard: result.data,
          // };
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
