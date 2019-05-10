/* tslint:disable:import-blacklist */
import angular from 'angular';
import moment from 'moment';
import _ from 'lodash';
import $ from 'jquery';
import kbn from 'app/core/utils/kbn';
import * as dateMath from '@grafana/ui/src/utils/datemath';
import impressionSrv from 'app/core/services/impression_srv';

export class DashboardLoaderSrv {
  /** @ngInject */
  constructor(
    private backendSrv,
    private dashboardSrv,
    private datasourceSrv,
    private $http,
    private $q,
    private $timeout,
    contextSrv,
    private $routeParams,
    private $rootScope
  ) {}

  _dashboardLoadFailed(title, snapshot?) {
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
      dashboard: { title: title },
    };
  }

  loadDashboard(type, slug, uid) {
    let promise;

    if (type === 'script') {
      promise = this._loadScriptedDashboard(slug);
    } else if (type === 'snapshot') {
      promise = this.backendSrv.get('/api/snapshots/' + slug).catch(() => {
        return this._dashboardLoadFailed('Snapshot not found', true);
      });
    } else {
      promise = this.backendSrv
        .getDashboardByUid(uid)
        .then(result => {
          if (result.meta.isFolder) {
            this.$rootScope.appEvent('alert-error', ['Dashboard not found']);
            throw new Error('Dashboard not found');
          }
          return result;
        })
        .catch(() => {
          return this._dashboardLoadFailed('Not found', true);
        });
    }

    promise.then(result => {
      if (result.meta.dashboardNotFound !== true) {
        impressionSrv.addDashboardImpression(result.dashboard.id);
      }

      return result;
    });

    return promise;
  }

  _loadScriptedDashboard(file) {
    const url = 'public/dashboards/' + file.replace(/\.(?!js)/, '/') + '?' + new Date().getTime();

    return this.$http({ url: url, method: 'GET' })
      .then(this._executeScript.bind(this))
      .then(
        result => {
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
        err => {
          console.log('Script dashboard error ' + err);
          this.$rootScope.appEvent('alert-error', [
            'Script Error',
            'Please make sure it exists and returns a valid dashboard',
          ]);
          return this._dashboardLoadFailed('Scripted dashboard');
        }
      );
  }

  _executeScript(result) {
    const services = {
      dashboardSrv: this.dashboardSrv,
      datasourceSrv: this.datasourceSrv,
      $q: this.$q,
    };

    /*jshint -W054 */
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
      const deferred = this.$q.defer();
      scriptResult(dashboard => {
        this.$timeout(() => {
          deferred.resolve({ data: dashboard });
        });
      });
      return deferred.promise;
    }

    return { data: scriptResult };
  }
}

angular.module('grafana.services').service('dashboardLoaderSrv', DashboardLoaderSrv);
