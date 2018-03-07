/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

/* eslint-disable no-shadow, no-param-reassign */

import angular from 'angular';
import { servicesModule } from '../../common';
import './adrem/module';
import { NetCrunchConnectionCache } from './connectionCache';
import { NetCrunchConnection, CONNECTION_CONSTS, NETCRUNCH_TREND_DATA_CONST } from './netCrunchConnection/connection';

const
  CONNECTION_ERROR_MESSAGES = CONNECTION_CONSTS.ERROR_MESSAGES,
  MAX_SAMPLE_COUNT = NETCRUNCH_TREND_DATA_CONST.MAX_SAMPLE_COUNT,
  NET_CRUNCH_API_SERVICE_DI = ['adrem', 'alertSrv', 'backendSrv', '$rootScope'];

class NetCrunchAPIService {

  constructor(adrem, alertSrv, backendSrv, $rootScope) {
    this.adrem = adrem;
    this.alertSrv = alertSrv;
    this.backendSrv = backendSrv;
    this.$rootScope = $rootScope;
    this.cache = new NetCrunchConnectionCache();
  }

  testConnection(datasource) {
    return this.clearConnection(datasource)
      .then(() => this.getConnection(datasource, true))
      .then(() => this.clearConnection(datasource));
  }

  clearConnection(datasource) {
    const self = this;
    return new Promise((resolve) => {
      if (self.cache.connectionExist(datasource)) {
        self.cache.getConnection(datasource)
          .then((connection) => {
            connection.logout()
              .then(() => {
                self.cache.deleteConnection(datasource);
                resolve();
              });
          });
      } else {
        resolve();
      }
    });
  }

  getConnection(datasource, withoutNetworkAtlas = false) {
    const self = this;

    function getConnectionFromCache(datasource) {
      return self.cache.getConnection(datasource)
        .then((connection) => {
          connection.fromCache = true;
          return connection;
        });
    }

    function getServerApi(connection) {
      return new Promise((resolve, reject) => {
        self.backendSrv.get(`${connection.apiURL}api.json`)
          .then((api) => {
            resolve(api);
          })
          .catch((error) => {
            error.isHandled = true;
            reject(CONNECTION_CONSTS.ERROR_SERVER_API);
          });
      });
    }

    function addConnectionHandlers(datasource, connection) {

      connection.onError = (error) => {
        self.alertSrv.set(error.connectionName, error.message, 'error');
      };

      connection.onNodesChanged = () => {
        self.$rootScope.$broadcast(`netcrunch-nodes-data-changed(${datasource.name})`);
      };

      connection.onNetworksChanged = () => {
        self.$rootScope.$broadcast(`netcrunch-networks-data-changed(${datasource.name})`);
      };

      return connection;
    }

    function createSession(datasource, connection) {
      return new Promise((resolve, reject) => {
        connection.login(datasource.username, datasource.password, withoutNetworkAtlas)
          .then(() => {
            connection.fromCache = false;
            resolve(connection);
          })
          .catch((error) => {
            self.cache.deleteConnection(datasource);
            connection.logout();
            reject(error);
          });
      });
    }

    if (!this.cache.connectionExist(datasource)) {
      let connection = new NetCrunchConnection(this.adrem, datasource.url, datasource.name);

      return getServerApi(connection)
        .then(serverApi =>
          new Promise((resolve, reject) => {
            const checkStatus = NetCrunchConnection.checkApiVersion(serverApi);
            if (checkStatus.status === 0) {
              resolve(checkStatus.version);
            } else {
              reject(checkStatus.status);
            }
          })
        )
        .then(() => {
          connection = addConnectionHandlers(datasource, connection);
          self.cache.addConnection(datasource, createSession(datasource, connection));
          return self.cache.getConnection(datasource);
        });
    }
    return getConnectionFromCache(datasource);
  }

}

NetCrunchAPIService.$inject = NET_CRUNCH_API_SERVICE_DI;

export {
  CONNECTION_ERROR_MESSAGES,
  MAX_SAMPLE_COUNT
};

angular
  .module(servicesModule)
    .service('netCrunchAPIService', NetCrunchAPIService);
