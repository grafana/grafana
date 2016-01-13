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
      .factory('netCrunchConnectionProvider', function ($q, $rootScope, adrem, backendSrv, alertSrv,
                                                        netCrunchConnectionProviderConsts) {

        var connectionPool = Object.create(null);

        function AtlasTree(netCrunchServerConnection) {

          var mapTree = {
                '' : {
                  children : []
                }
              },
              orphans = [],
              nodes = {},
              iconSize = 25,

              MAP_ICON_ID_UNKNOWN = 100;

          function getDeviceIcon(deviceTypeXML) {
            if (deviceTypeXML !== '' && deviceTypeXML != null) {
              var doc = $.parseXML(deviceTypeXML),
                devtype = $(doc).find('devtype');
              return devtype.attr('iconid') || MAP_ICON_ID_UNKNOWN;
            } else {
              return 0;
            }
          }

          function getMapIconUrl (iconId, size) {
            size = size || 32;
            return netCrunchServerConnection.ncSrv.IMapIcons.GetIcon.asURL(iconId, size);
          }

          function pushUniqueChildToMap (map, child) {
            var isUnique;

            isUnique = map.children.every(function(mapChild) {
              return (mapChild.data.values.NetIntId !== child.data.values.NetIntId);
            });

            if (isUnique === true) {
              map.children.push(child);
            }
          }

          return {
            tree : mapTree,
            nodes : nodes,

            addMapToIndex : function (mapRec) {
              var parentId = mapRec.local.parentId,
                netId = mapRec.values.NetIntId;

              mapTree[netId] = {
                data : mapRec,
                children : []
              };

              orphans = orphans.filter(function (orphan) {
                if (orphan.data.local.parentId === netId) {
                  pushUniqueChildToMap(mapTree[netId], orphan);
                  return false;
                }
                return true;
              });

              if (mapTree[parentId] != null) {
                pushUniqueChildToMap(mapTree[parentId], mapTree[netId]);
              } else {
                orphans.push(mapTree[netId]);
              }
            },

            addNode : function (nodeRec) {
              nodeRec.local.iconUrl = getMapIconUrl(getDeviceIcon(nodeRec.values.DeviceType), iconSize);
              nodes[nodeRec.values.Id] = nodeRec;
            },

            generateMapList : function() {

              var mapList = [];

              function sortMaps(first, second){
                if (first.data.values.DisplayName === second.data.values.DisplayName) {
                  return 0;
                } else {
                  if (first.data.values.DisplayName < second.data.values.DisplayName) {
                    return -1;
                  } else {
                    return 1;
                  }
                }
              }

              function performMapList(maps, innerLevel, parentIndex){
                maps.sort(sortMaps);
                maps.forEach(function(map) {
                  map.data.local.innerLevel = innerLevel;
                  map.data.local.parentLinearIndex = parentIndex;
                  if (map.data.local.isFolder === true) {
                    mapList.push(map);
                    performMapList(map.children, innerLevel + 1, mapList.length - 1);
                  } else {
                    mapList.push(map);
                  }
                });
              }

              performMapList(mapTree[''].children, 1, 'root');
              return mapList;
            }
          }
        }

        function NetworkDataProvider(adrem, netCrunchServerConnection) {

          var networkData,
              hostsData,
              atlasTree = new AtlasTree(netCrunchServerConnection),
              initialized = null;

          function openRemoteData(table, query, processFunction, broadcastMessageName) {
            var networkData = new adrem.RemoteDataListStore('ncSrv', 1000, netCrunchServerConnection);

            networkData.on('changed', function () {
              $rootScope.$broadcast(broadcastMessageName);
            });

            if (processFunction != null) {
              networkData.on('record-changed', function (data) {
                if (networkData.data != null && networkData.data.length > 0) {
                  data.forEach(processFunction, this);
                }
              });
            }

            networkData.open(table, query);
            return networkData;
          }

          function decodeNetworkData(record) {
            var mapsData;

            function addNodesToNetwork(network) {
              var nodeData,
                len, i;

              network.local.nodes = [];
              len = network.values.HostMapData[0];

              for (i = 1; i <= len; i++) {
                nodeData = network.values.HostMapData[i];
                if (nodeData[0] === 0 || nodeData[0] === 5) {
                  network.local.nodes.push(parseInt(nodeData[1], 10));
                }
              }
            }

            record.local.parentId = parseInt(record.values.NetworkData[0], 10);
            if (isNaN(record.local.parentId) === true) { record.local.parentId = ''; }

            record.local.isFolder = (record.values.MapClassTag === 'dynfolder' || Array.isArray(record.values.NetworkData[1]));

            if (record.local.isFolder) {
              mapsData = record.values.NetworkData[1];
              if (Array.isArray(mapsData)) {            // otherwise it can be empty object instead of empty array
                record.local.maps = mapsData.map(function (id) {
                  return parseInt(id, 10);
                });
              }

              if (record.values.MapClassTag === 'fnet') {                   //Add nodes into physical segments map
                addNodesToNetwork(record);
              }
            } else {
              addNodesToNetwork(record);
            }

            return record;
          }

          return {
            networkNodes : atlasTree.nodes,
            networkTree : atlasTree.tree,
            init : function () {
              var performanceViewsNetIntId = 2,
                monitoringPacksNetIntId = 3;

              var processHostsData = function (data) {
                var host = Object.create(null);
                host.local = Object.create(null);
                host.values = data.getValues();
                atlasTree.addNode(host);
              };

              var processMapData = function (data) {
                var map = Object.create(null);
                map.local = data.local;
                map.values = data.getValues();
                atlasTree.addMapToIndex(decodeNetworkData(map));
              };

              if (initialized != null) { return initialized; }

              hostsData = openRemoteData('Hosts', 'Select Id, Name, Address, DeviceType, GlobalDataNode ',
                                         processHostsData, 'netcrunch-host-data-changed');

              networkData = openRemoteData('Networks', 'Select NetIntId, DisplayName, HostMapData, IconId, ' +
                'MapType, NetworkData, MapClassTag ' +
                'where (MapClassTag != \'policynet\') && (MapClassTag != \'pnet\') && ' +
                '(MapClassTag != \'dependencynet\') && ' +
                '(MapClassTag != \'issuesnet\') && (MapClassTag != \'all\') && ' +
                '(NetIntId != ' + performanceViewsNetIntId + ') && ' +
                '(NetIntId != ' + monitoringPacksNetIntId + ')',
                processMapData, 'netcrunch-network-data-changed');

              initialized = $q.all([hostsData, networkData]);
              return initialized;
            }
          }
        }

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
              networkAtlasReady = $q.defer(),
              trendQuery,
              self = this;

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

          function login(userName, password, ignoreDownloadNetworkAtlas) {
            if (serverVersion == null) {
              serverVersion = checkServerVersion();
            }
            return serverVersion.then(function() {
              if (serverConnection == null) {
                serverConnectionReady = establishConnection();
              }
              return serverConnectionReady.then(function() {
                return authenticateUser(userName, password).then(function() {
                  self.networkAtlas = getNetworkDataProvider();
                  if (ignoreDownloadNetworkAtlas !== true) {
                    self.networkAtlas.init().then(function(){
                      networkAtlasReady.resolve(self.networkAtlas);
                    });
                  }
                });
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

          function getNetworkDataProvider() {
            return new NetworkDataProvider(adrem, serverConnection);
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
          this.networkAtlas = Object.create(null);
          this.networkAtlasReady = networkAtlasReady.promise;
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
