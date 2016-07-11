///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import config from 'app/core/config';
import coreModule from 'app/core/core_module';

export class BackendSrv {
  inFlightRequests = {};
  HTTP_REQUEST_CANCELLED = -1;

    /** @ngInject */
  constructor(private $http, private alertSrv, private $rootScope, private $q, private $timeout) {
  }

  get(url, params?) {
    return this.request({ method: 'GET', url: url, params: params });
  }

  delete(url) {
    return this.request({ method: 'DELETE', url: url });
  }

  post(url, data) {
    return this.request({ method: 'POST', url: url, data: data });
  };

  patch(url, data) {
    return this.request({ method: 'PATCH', url: url, data: data });
  }

  put(url, data) {
    return this.request({ method: 'PUT', url: url, data: data });
  }

  requestErrorHandler(err) {
    if (err.isHandled) {
      return;
    }

    var data = err.data || { message: 'Unexpected error' };
    if (_.isString(data)) {
      data = { message: data };
    }

    if (err.status === 422) {
      this.alertSrv.set("Validation failed", data.message, "warning", 4000);
      throw data;
    }

    data.severity = 'error';

    if (err.status < 500) {
      data.severity = "warning";
    }

    if (data.message) {
      this.alertSrv.set("Problem!", data.message, data.severity, 10000);
    }

    throw data;
  }

  request(options) {
    options.retry = options.retry || 0;
    var requestIsLocal = options.url.indexOf('/') === 0;
    var firstAttempt = options.retry === 0;

    if (requestIsLocal && !options.hasSubUrl) {
      options.url = config.appSubUrl + options.url;
      options.hasSubUrl = true;
    }

    return this.$http(options).then(results => {
      if (options.method !== 'GET') {
        if (results && results.data.message) {
          this.alertSrv.set(results.data.message, '', 'success', 3000);
        }
      }
      return results.data;
    }, err => {
      // handle unauthorized
      if (err.status === 401 && firstAttempt) {
        return this.loginPing().then(() => {
          options.retry = 1;
          return this.request(options);
        });
      }

      this.$timeout(this.requestErrorHandler.bind(this, err), 50);
      throw err;
    });
  };

  datasourceRequest(options) {
    options.retry = options.retry || 0;

    // A requestID is provided by the datasource as a unique identifier for a
    // particular query. If the requestID exists, the promise it is keyed to
    // is canceled, canceling the previous datasource request if it is still
    // in-flight.
    var canceler;
    if (options.requestId) {
      canceler = this.inFlightRequests[options.requestId];
      if (canceler) {
        canceler.resolve();
      }
      // create new canceler
      canceler = this.$q.defer();
      options.timeout = canceler.promise;
      this.inFlightRequests[options.requestId] = canceler;
    }

    var requestIsLocal = options.url.indexOf('/') === 0;
    var firstAttempt = options.retry === 0;

    if (requestIsLocal && options.headers && options.headers.Authorization) {
      options.headers['X-DS-Authorization'] = options.headers.Authorization;
      delete options.headers.Authorization;
    }

    return this.$http(options).catch(err => {
      if (err.status === this.HTTP_REQUEST_CANCELLED) {
        throw {err, cancelled: true};
      }

      // handle unauthorized for backend requests
      if (requestIsLocal && firstAttempt && err.status === 401) {
        return this.loginPing().then(() => {
          options.retry = 1;
          if (canceler) {
            canceler.resolve();
          }
          return this.datasourceRequest(options);
        });
      }

      //populate error obj on Internal Error
      if (_.isString(err.data) && err.status === 500) {
        err.data = {
          error: err.statusText
        };
      }

      // for Prometheus
      if (!err.data.message && _.isString(err.data.error)) {
        err.data.message = err.data.error;
      }

      throw err;
    }).finally(() => {
      // clean up
      if (options.requestId) {
        delete this.inFlightRequests[options.requestId];
      }
    });
  };

  loginPing() {
    return this.request({url: '/api/login/ping', method: 'GET', retry: 1 });
  }

  search(query) {
    return this.get('/api/search', query);
  }

  getDashboard(type, slug) {
    return this.get('/api/dashboards/' + type + '/' + slug);
  }

  saveDashboard(dash, options) {
    options = (options || {});
    return this.post('/api/dashboards/db/', {dashboard: dash, overwrite: options.overwrite === true});
  }
}

coreModule.service('backendSrv', BackendSrv);
