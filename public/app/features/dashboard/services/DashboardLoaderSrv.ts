import angular from 'angular';
import moment from 'moment'; // eslint-disable-line no-restricted-imports
import _ from 'lodash';
import $ from 'jquery';
import kbn from 'app/core/utils/kbn';
import { AppEvents, dateMath, UrlQueryValue } from '@grafana/data';
import impressionSrv from 'app/core/services/impression_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSrv } from './DashboardSrv';
import DatasourceSrv from 'app/features/plugins/datasource_srv';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';

export class DashboardLoaderSrv {
  /** @ngInject */
  constructor(
    private dashboardSrv: DashboardSrv,
    private datasourceSrv: DatasourceSrv,
    private $http: any,
    private $timeout: any,
    contextSrv: any,
    private $routeParams: any,
    private $rootScope: GrafanaRootScope
  ) {}

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
    } else {
      promise = backendSrv
        .getDashboardByUid(uid)
        .then((result: any) => {
          if (result.meta.isFolder) {
            this.$rootScope.appEvent(AppEvents.alertError, ['Dashboard not found']);
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

    return this.$http({ url: url, method: 'GET' })
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
          this.$rootScope.appEvent(AppEvents.alertError, [
            'Script Error',
            'Please make sure it exists and returns a valid dashboard',
          ]);
          return this._dashboardLoadFailed('Scripted dashboard');
        }
      );
  }

  _executeScript(result: any) {
    const services = {
      dashboardSrv: this.dashboardSrv,
      datasourceSrv: this.datasourceSrv,
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
      result.data
    );
    const scriptResult = scriptFunc(this.$routeParams, kbn, dateMath, _, moment, window, document, $, $, services);

    // Handle async dashboard scripts
    if (_.isFunction(scriptResult)) {
      return new Promise(resolve => {
        scriptResult((dashboard: any) => {
          this.$timeout(() => {
            resolve({ data: dashboard });
          });
        });
      });
    }

    return { data: scriptResult };
  }
}

angular.module('grafana.services').service('dashboardLoaderSrv', DashboardLoaderSrv);
