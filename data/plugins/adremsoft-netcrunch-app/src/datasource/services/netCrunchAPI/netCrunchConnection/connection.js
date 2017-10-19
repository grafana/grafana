/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

import { NetCrunchNetworkData } from './networkData/networkData';
import { NetCrunchCountersData } from './countersData';
import { NetCrunchTrendData, NETCRUNCH_TREND_DATA_CONST } from './trendData';

const
  CONNECTION_CONSTS = {
    API_NAME: '/ncapi/',

    NC_SERVER_VER_MAJOR: 10,
    NC_SERVER_VER_MINOR: 0,

    STATUS_OK: 0,
    ERROR_SERVER_API: 1,
    ERROR_SERVER_VER: 2,
    ERROR_CONNECTION_INIT: 3,
    ERROR_AUTHENTICATION: 4,
    ERROR_MESSAGES: [
      '',
      'Server connection failed',
      'NetCrunch server version should be 10.0 or greater',
      'Server connection initialization failed',
      'Authentication failed'
    ]
  };

class NetCrunchConnection {

  constructor(adrem, serverURL, connectionName) {
    this.adrem = adrem;
    this.apiName = CONNECTION_CONSTS.API_NAME;
    this.apiURL = serverURL + this.apiName;
    this.connectionName = connectionName;
    this.serverConnection = null;
    this.serverConnectionReady = null;
    this.netCrunchClient = null;
    this.trendQuery = null;
    this.loginInProgress = false;
    this.loginInProgressPromise = null;
    this.networkAtlas = new Map();
    this.networkAtlasReady = new Promise((resolve) => { this.networkAtlasReadyResolve = resolve; });
    this.counters = new Map();
    this.trends = null;
  }

  static checkApiVersion(serverApi) {

    function parseVersion(version) {
      const
        versionPattern = /^(\d+).(\d+).(\d+)(.(\d+))*$/,
        versionElements = versionPattern.exec(version);

      if (versionElements != null) {
        return {
          major: versionElements[1],
          minor: versionElements[2],
          bugfix: versionElements[3],
          text: version
        };
      }

      return null;
    }

    function versionGreaterEqualThan(version, major, minor) {
      let result = false;

      if (parseInt(version.major, 10) >= parseInt(major, 10)) {
        if (parseInt(version.major, 10) > parseInt(major, 10)) {
          result = true;
        } else if (parseInt(version.minor, 10) >= parseInt(minor, 10)) {
          result = true;
        }
      }

      return result;
    }

    function createResult(status, version = null) {
      return {
        status,
        version
      };
    }

    if ((serverApi.api != null) && (serverApi.api[0] != null) && (serverApi.api[0].ver != null)) {
      const
        minMajor = CONNECTION_CONSTS.NC_SERVER_VER_MAJOR,
        minMinor = CONNECTION_CONSTS.NC_SERVER_VER_MINOR,
        version = parseVersion(serverApi.api[0].ver);

      if (version != null) {
        if (versionGreaterEqualThan(version, minMajor, minMinor)) {
          return createResult(CONNECTION_CONSTS.STATUS_OK, version);
        }
        return createResult(CONNECTION_CONSTS.ERROR_SERVER_VER, version);
      }
      return createResult(CONNECTION_CONSTS.ERROR_SERVER_VER);
    }
    return createResult(CONNECTION_CONSTS.ERROR_SERVER_VER);
  }

  login(userName, password, ignoreDownloadNetworkAtlas = false) {
    const self = this;

    function nodesChanged() {
      if (typeof this.onNodesChanged === 'function') {
        this.onNodesChanged();
      }
    }

    function networksChanged() {
      if (typeof this.onNetworksChanged === 'function') {
        this.onNetworksChanged();
      }
    }

    function getUserProfileData() {
      return new Promise(resolve =>
        self.serverConnection.ncSrv.ICurrentUserProfile.GetProfileData(userProfile =>
          resolve(userProfile)));
    }

    if (this.serverConnection == null) {
      this.serverConnectionReady = this.establishConnection();
    }

    return this.serverConnectionReady
      .then(() =>
        this.authenticateUser(userName, password)
          .then(() => getUserProfileData())
          .then((userProfile) => {
            this.userProfile = userProfile;
            this.networkAtlas = new NetCrunchNetworkData(this.adremClient, this);
            this.networkAtlas.onNodesChanged = nodesChanged.bind(this);
            this.networkAtlas.onNetworksChanged = networksChanged.bind(this);
            this.counters = new NetCrunchCountersData(this.adremClient, this.serverConnection);
            this.trends = new NetCrunchTrendData(this);

            if (ignoreDownloadNetworkAtlas !== true) {
              this.networkAtlas.init()
                .then(() => {
                  this.networkAtlasReadyResolve(this.networkAtlas);
                });
            }
            return true;
          })
      );
  }

  logout() {
    const self = this;
    return new Promise((resolve) => {
      if (self.serverConnectionReady != null) {
        self.serverConnectionReady
          .then(() => {
            self.netCrunchClient.logout(() => {
              resolve();
            });
          })
          .catch(() => {
            resolve();
          });
      } else {
        resolve();
      }
    });
  }

  establishConnection() {
    const self = this;
    return new Promise((resolve, reject) => {
      self.adrem.then((adrem) => {
        const
          apiName = self.apiName,
          apiURL = self.apiURL;

        self.adremClient = adrem;

        self.serverConnection = new adrem.Connection(apiURL);
        self.serverConnection.useWebSocket = false;
        self.serverConnection.reloadOnLogout = false;

        self.netCrunchClient = self.serverConnection.Client;

        self.netCrunchClient.urlFilter = url => apiURL + url.replace(apiName, '');

        self.netCrunchClient.on('exception', (e) => {
          if (typeof self.onError === 'function') {
            self.onError({
              connectionName: self.connectionName,
              message: e.message
            });
          }
        });

        self.netCrunchClient.start('', (status) => {
          if (status.init === true) {
            resolve();
          } else {
            reject(CONNECTION_CONSTS.ERROR_CONNECTION_INIT);
          }
        });

      });
    });
  }

  authenticateUser(userName, password) {
    const
      MAX_LOGIN_ATTEMPTS = 3,
      BASE_LOGIN_TIMEOUT = 5000,
      netCrunchClient = this.netCrunchClient;
    let loginProcess;

    function loginTimeout(attempt) {
      return ((MAX_LOGIN_ATTEMPTS - attempt) + 1) * BASE_LOGIN_TIMEOUT;
    }

    function tryAuthenticate(userName, password, attempt) {           // eslint-disable-line
      return new Promise((resolve, reject) => {
        netCrunchClient.login(userName, password, (status) => {
          if (status === true) {
            resolve();
          } else if (attempt > 1) {
            setTimeout(() => {
              tryAuthenticate(userName, password, attempt - 1)
                .then(() => { resolve(); })
                .catch(() => { reject(); });
            }, loginTimeout(attempt));
          } else {
            reject();
          }
        });
      });
    }

    if (this.loggedIn() === false) {
      if (this.loginInProgress === false) {
        const self = this;
        this.loginInProgress = true;
        loginProcess = new Promise((resolve, reject) => {
          tryAuthenticate(userName, password, MAX_LOGIN_ATTEMPTS)
            .then(() => {
              self.loginInProgress = false;
              self.loginInProgressPromise = null;
              resolve();
            })
            .catch(() => {
              self.loginInProgress = false;
              self.loginInProgressPromise = null;
              reject(CONNECTION_CONSTS.ERROR_AUTHENTICATION);
            });
        });
        this.loginInProgressPromise = loginProcess;
      } else {
        loginProcess = this.loginInProgressPromise;
      }
    } else {
      loginProcess = Promise.resolve();
    }
    return loginProcess;
  }

  loggedIn() {
    return ((this.netCrunchClient != null) && ('Session' in this.netCrunchClient) &&
            (this.netCrunchClient.status.logged === true));
  }

  queryTrendData() {
    if (this.trendQuery == null) {
      this.trendQuery = new this.serverConnection.ncSrv.ITrendQuery();
    }
    return this.callApi(this.trendQuery.AnalyzeGetData, arguments);       // eslint-disable-line
  }

  callApi(apiCall, args, acceptEmpty = true) {
    const self = this;
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line
      args = Array.prototype.slice.call(args, 0);   // convert arguments to Array
      apiCall.apply(self, args.concat([(data) => {
        if ((data !== undefined) || acceptEmpty) {
          resolve(data);
        } else {
          reject();
        }
      }]));
    });
  }

}

export {
  CONNECTION_CONSTS,
  NETCRUNCH_TREND_DATA_CONST,
  NetCrunchConnection
};
