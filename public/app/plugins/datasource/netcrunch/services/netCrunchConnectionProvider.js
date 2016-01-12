/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2016-01-07
 *
 * 2016 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

define([
    'angular',
    'NCObjects',
    'remoteDataLists'
  ],

  function (angular) {

    'use strict';

    var module = angular.module('grafana.services');

    module
      .factory('netCrunchConnectionProvider', function ($q, adrem, backendSrv, alertSrv,
                                                        netCrunchConnectionProviderConsts) {

        var connectionPool = Object.create(null);

        function NetCrunchConnection(datasourceURL, datasourceName) {
          var apiName = netCrunchConnectionProviderConsts.API_NAME,
              apiURL = datasourceURL + apiName,
              connectionName = datasourceName,
              serverVersion,
              serverConnection,
              serverConnectionReady,
              netCrunchClient,
              loginInProgress = false,
              loginInProgressPromise,
              trendQuery;

          function getServerApi() {
            var serverApi = $q.defer();

            backendSrv.get(apiURL + 'api.json').then(function(api) {
              serverApi.resolve(api);
            }, function(error) {
              error.isHandled = true;
              serverApi.reject(netCrunchConnectionProviderConsts.ERROR_SERVER_API);
            });
            return serverApi.promise;
          }

          function checkServerVersion() {

            function parseVersion(version) {
              var versionPattern = /^(\d+).(\d+).(\d+)(.(\d+))*$/,
                  versionElements = versionPattern.exec(version);

              if (versionElements != null) {
                return {
                  major : versionElements[1],
                  minor : versionElements[2],
                  bugfix : versionElements[3],
                  text : version
                };
              } else {
                return null;
              }
            }

            return getServerApi().then(function(serverApi) {
              var version;

              if ((serverApi.api != null) && (serverApi.api[0] != null) && (serverApi.api[0].ver != null)) {
                version = parseVersion(serverApi.api[0].ver);
                if (version != null) {
                  if (parseInt(version.major) >= 9) {
                    return $q.when(version);
                  } else {
                    return $q.reject(netCrunchConnectionProviderConsts.ERROR_SERVER_VER, version);
                  }
                } else {
                  return $q.reject(netCrunchConnectionProviderConsts.ERROR_SERVER_VER);
                }
              } else {
                return $q.reject(netCrunchConnectionProviderConsts.ERROR_SERVER_VER);
              }
            });
          }

          function establishConnection () {
            var connectionState = $q.defer();

            serverConnection = new adrem.Connection();
            serverConnection.useWebSocket = false;
            netCrunchClient = serverConnection.Client;

            netCrunchClient.on('exception', function (e) {
              alertSrv.set(connectionName, e.message, 'error');
            });

            netCrunchClient.urlFilter = function(url) {
              url = url.replace(apiName, '');
              url = apiURL + url;
              return url;
            };

            netCrunchClient.start('', function(status) {
              if (status.init === true) {
                connectionState.resolve();
              } else {
                connectionState.reject(netCrunchConnectionProviderConsts.ERROR_CONNECTION_INIT);
              }
            });
            return connectionState.promise;
          }

          function authenticateUser(userName, password) {
            var loginDefer = $q.defer(),
                loginProcess;

            if (loggedIn() === false) {
              if (loginInProgress === false) {
                loginInProgress = true;
                loginProcess = loginDefer.promise;
                loginInProgressPromise = loginProcess;
                netCrunchClient.login(userName, password, function(status) {
                  loginInProgress = false;
                  loginInProgressPromise = null;
                  if (status === true) {
                    loginDefer.resolve();
                  } else {
                    loginDefer.reject(netCrunchConnectionProviderConsts.ERROR_AUTHENTICATION);
                  }
                });
              } else {
                loginProcess = loginInProgressPromise;
              }
            } else {
              loginProcess = $q.when();
            }
            return loginProcess;
          }

          function login(userName, password) {
            if (serverVersion == null) {
              serverVersion = checkServerVersion();
            }
            return serverVersion.then(function() {
              if (serverConnection == null) {
                serverConnectionReady = establishConnection();
              }
              return serverConnectionReady.then(function() {
                return authenticateUser(userName, password);
              });
            });
          }

          function loggedIn() {
            return ((netCrunchClient != null) && ('Session' in netCrunchClient) && (netCrunchClient.status.logged === true));
          }

          function queryTrendData() {
            if (trendQuery == null) {
              trendQuery = new serverConnection.ncSrv.ITrendQuery();
            }
            return callApi(trendQuery.AnalyzeGetData, arguments);
          }

          function callApi (apiCall, args, acceptEmpty) {
            var def = $q.defer();
            acceptEmpty = (acceptEmpty === undefined) ? true : acceptEmpty;
            args = Array.prototype.slice.call(args, 0);       // convert arguments to Array
            apiCall.apply(this, args.concat([function (data) {
              if (data !== undefined || acceptEmpty) {
                def.resolve(data);
              } else {
                def.reject();
              }
            }]));
            return def.promise;
          }

          this.login = login;
          this.queryTrendData = queryTrendData;
        }

        function getConnection(datasource) {
          var connection,
              connectionLoggedIn,
              connectionKey = datasource.serverUrl;

          if (connectionPool[connectionKey] == null) {
            connection = new NetCrunchConnection(datasource.url, datasource.name);
            connectionPool[connectionKey] = connection.login(datasource.username, datasource.password).then(
              function() {
                return connection;
              },
              function(error) {
                connectionPool[connectionKey] = null;
                return $q.reject(error);
              });
            connectionLoggedIn = connectionPool[connectionKey];
          } else {
            connectionLoggedIn = connectionPool[connectionKey];
          }
          return connectionLoggedIn;
        }

        return {
          getConnection : getConnection
        };
      }
    );
});
