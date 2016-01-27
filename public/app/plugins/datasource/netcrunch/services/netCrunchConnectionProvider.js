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
    'jquery',
    'moment',
    'client',
    'NCObjects',
    'remoteDataLists',
    './netCrunchCounters'
  ],

  function (angular, $, moment, adrem) {

    'use strict';

    var module = angular.module('grafana.services');

    module.factory('adrem', function() { return adrem; });
    module.factory('netCrunchConnectionProvider', function ($q, $rootScope, adrem, backendSrv, alertSrv,
                                                            netCrunchConnectionProviderConsts, netCrunchCounters,
                                                            netCrunchCounterConsts, netCrunchTrendDataProviderConsts) {

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
          var iconUrl;
          size = size || 32;
          iconUrl = netCrunchServerConnection.ncSrv.IMapIcons.GetIcon.asURL(iconId, size);
          return netCrunchServerConnection.Client.urlFilter(iconUrl);
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
        };
      }

      function NetworkDataProvider(adrem, netCrunchServerConnection, connectionTag) {

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

        connectionTag = (connectionTag == null) ? '' : connectionTag;

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
                                       processHostsData, 'netcrunch-host-data-changed(' + connectionTag + ')');

            networkData = openRemoteData('Networks', 'Select NetIntId, DisplayName, HostMapData, IconId, ' +
              'MapType, NetworkData, MapClassTag ' +
              'where (MapClassTag != \'policynet\') && (MapClassTag != \'pnet\') && ' +
              '(MapClassTag != \'dependencynet\') && ' +
              '(MapClassTag != \'issuesnet\') && (MapClassTag != \'all\') && ' +
              '(NetIntId != ' + performanceViewsNetIntId + ') && ' +
              '(NetIntId != ' + monitoringPacksNetIntId + ')',
              processMapData, 'netcrunch-network-data-changed(' + connectionTag + ')');

            initialized = $q.all([hostsData, networkData]);
            return initialized;
          }
        };
      }

      function CountersDataProvider(adrem, netCrunchServerConnection) {

        var ncCounters = netCrunchCounters.getNetCrunchCounters(adrem, netCrunchServerConnection),
            counterConsts = netCrunchCounterConsts,
            trendDB = null;

        return {
          prepareCountersForMonitors: function (counters) {
            var monitors = Object.create(null),
                counterPromises = [],
                self = this;

            function createCounterObject (counter) {
              return self.convertCounterPathToDisplay(counter[1]).then(function(displayName) {
                return {
                  name: counter[1],
                  displayName: displayName
                };
              });
            }

            function compareCounters (counterA, counterB) {
              if (counterA.displayName < counterB.displayName) { return -1; }
              if (counterA.displayName > counterB.displayName) { return 1; }
              if (counterA.displayName === counterB.displayName) { return 0; }
            }

            function sortCounters (monitors){
              Object.keys(monitors).forEach(function(monitorId) {
                monitors[monitorId].counters.sort(compareCounters);
              });
              return monitors;
            }

            function updateMonitorNames (monitors){
              return self.getMonitors().then(function(monitorsMap) {
                Object.keys(monitors).forEach(function(monitorId) {
                  if (monitorsMap[monitorId] != null){
                    monitors[monitorId].name = monitorsMap[monitorId].counterGroup;
                  }
                });
                return monitors;
              });
            }

            counters.forEach(function (counter) {
              if (monitors[counter[0]] == null) {
                monitors[counter[0]] = Object.create(null);
                monitors[counter[0]].counters = [];
              }

              monitors[counter[0]].counters.push(createCounterObject(counter));
            });

            Object.keys(monitors).forEach(function(monitorId) {
              counterPromises.push($q.all(monitors[monitorId].counters).then(function(counters) {
                monitors[monitorId].counters = counters;
              }));
            });

            return $q.all(counterPromises).then(function() {
              monitors = sortCounters(monitors);
              return updateMonitorNames(monitors);
            });
          },

          getCounters: function (machineId) {
            if (trendDB == null) {
              trendDB = new adrem.NetCrunch.TrendDB('ncSrv', '', function() {}, netCrunchServerConnection);
            }

            return $q(function (resolve) {
              trendDB.getCounters({machineId: machineId}, function (counters) {

                // counters are in form [ "<monitorId>=<counter>", ... ]

                counters = counters.map(function(counter) {
                  return counter.split('=');
                });
                resolve(counters);
              });
            });
          },

          convertCounterPathToDisplay: function (counterPath) {
            var parsedCounterPath = ncCounters.parseCounterPath(counterPath),
                counterPathObject;

            if (ncCounters.isMIBCnt(parsedCounterPath.obj, parsedCounterPath.cnt) === true) {
              counterPathObject = ncCounters.counterPathObject(counterPath, counterConsts.CNT_TYPE.cstMIB);
              return ncCounters.counterPathToDisplayStr(counterPathObject, true, true);
            } else {
              return ncCounters.counterPathToDisplayStr(counterPath, true, true);
            }
          },

          getMonitors: function () {
            var monitorMgrInf = new adrem.NetCrunch.MonitorMgrIntf('ncSrv', function() {}, netCrunchServerConnection),
                deferred = $q.defer();

            monitorMgrInf.getMonitorsInfo({}, function(monitors) {
              var monitorsMap = Object.create(null);

              monitors.forEach(function(monitor) {
                monitorsMap[monitor.monitorId] = monitor;
              });
              deferred.resolve(monitorsMap);
            });
            return deferred.promise;
          }
        };
      }

      function TrendDataProvider(netCrunchConnection) {
        var
          PERIOD_TYPE = netCrunchTrendDataProviderConsts.PERIOD_TYPE,
          QUERY_RESULT_MASKS = netCrunchTrendDataProviderConsts.QUERY_RESULT_MASKS,
          QUERY_RESULT_ORDER = netCrunchTrendDataProviderConsts.QUERY_RESULT_ORDER;

        function calculateChartDataInterval (dateStart, dateEnd, maxSampleCount) {
          var min = 60 * 1000,
              hour = 60 * min,
              day = 24 * hour,
              month = 30 * day,
              dateRange = Number(dateEnd - dateStart),
              periodIndex,

              periods = [
                { length: min, type: PERIOD_TYPE.tpMinutes, interval: 1 },
                { length: 5 * min, type: PERIOD_TYPE.tpMinutes, interval: 5 },
                { length: 10 * min, type: PERIOD_TYPE.tpMinutes, interval: 10 },
                { length: 15 * min, type: PERIOD_TYPE.tpMinutes, interval: 15 },
                { length: 20 * min, type: PERIOD_TYPE.tpMinutes, interval: 20 },
                { length: 30 * min, type: PERIOD_TYPE.tpMinutes, interval: 30 },
                { length: hour, type: PERIOD_TYPE.tpHours, interval: 1 },
                { length: 2 * hour, type: PERIOD_TYPE.tpHours, interval: 2 },
                { length: 3 * hour, type: PERIOD_TYPE.tpHours, interval: 3 },
                { length: 4 * hour, type: PERIOD_TYPE.tpHours, interval: 4 },
                { length: 6 * hour, type: PERIOD_TYPE.tpHours, interval: 6 },
                { length: 8 * hour, type: PERIOD_TYPE.tpHours, interval: 8 },
                { length: day, type: PERIOD_TYPE.tpDays, interval: 1 },
                { length: 7 * day, type: PERIOD_TYPE.tpDays, interval: 7 },
                { length: month, type: PERIOD_TYPE.tpMonths, interval: 1 },
                { length: 3 * month, type: PERIOD_TYPE.tpMonths, interval: 3 },
                { length: 6 * month, type: PERIOD_TYPE.tpMonths, interval: 6 },
                { length: 9 * month, type: PERIOD_TYPE.tpMonths, interval: 9 },
                { length: 12 * month, type: PERIOD_TYPE.tpMonths, interval: 12 },
                { length: 15 * month, type: PERIOD_TYPE.tpMonths, interval: 15 },
                { length: 18 * month, type: PERIOD_TYPE.tpMonths, interval: 18 },
                { length: 21 * month, type: PERIOD_TYPE.tpMonths, interval: 21 },
                { length: 24 * month, type: PERIOD_TYPE.tpMonths, interval: 24 }
              ];

          periodIndex=0;

          periods.some(function (period, index) {
            if ((period.length * maxSampleCount) > dateRange) {
              periodIndex=index;
              return true;
            } else {
              return false;
            }
          });

          return {
            periodType: periods[periodIndex].type,
            periodInterval: periods[periodIndex].interval
          };
        }

        function calculateTimeDomain (dateFrom, periodType, periodInterval, intervalCount) {
          var timeDomain = [],
              timeCalculator = Object.create(null),
              timeDomainElement,
              I;

          timeCalculator[PERIOD_TYPE.tpMinutes] = 'minutes';
          timeCalculator[PERIOD_TYPE.tpHours] = 'hours';
          timeCalculator[PERIOD_TYPE.tpDays] = 'days';
          timeCalculator[PERIOD_TYPE.tpMonths] = 'months';

          dateFrom = moment(dateFrom).startOf('minute');
          for (I=0; I < intervalCount; I += 1) {
            timeDomainElement = moment(dateFrom).add(I * periodInterval, timeCalculator[periodType]);
            timeDomain.push(timeDomainElement.toDate());
          }

          return timeDomain;
        }

        function prepareResultMask (series) {
          var resultMask;

          resultMask = Object.keys(series).filter(function(seriesKey) {
            return ((series[seriesKey] === true) && (QUERY_RESULT_MASKS[seriesKey] != null));
          });

          resultMask = resultMask.map(function(seriesKey) {
            return QUERY_RESULT_MASKS[seriesKey];
          });

          return { ResultMask: [resultMask] };
        }

        function convertResultData(result, resultType) {
          var resultSeries,
              convertedData = Object.create(null);

          resultType = resultType.ResultMask[0];
          resultSeries = QUERY_RESULT_ORDER.filter(function(seriesType) {
            return (resultType.indexOf(QUERY_RESULT_MASKS[seriesType]) >= 0);
          });
          resultSeries.forEach(function(seriesName) {
            convertedData[seriesName] = [];
          });

          result.trend.forEach(function(data) {
            if (Array.isArray(data) === true) {
              data.forEach(function(value, $index) {
                convertedData[resultSeries[$index]].push(value);
              });
            } else {
              convertedData[resultSeries[0]].push(data);
            }
          });

          if (result.distr != null) {
            convertedData.distr = result.distr;
          }

          return convertedData;
        }

        function getCounterTrendData (nodeID, counter, dateFrom, dateTo, periodType,
                                      periodInterval, resultType) {

          //resultType possible values are :
          //    [ tqrAvg, tqrMin, tqrMax, tqrAvail, tqrDelta, tqrEqual, tqrDistr ]
          //Default tqrAvg is used : {ResultMask : [['tqrAvg']]}

          if ((nodeID == null) || (counter == null)) {
            return $q.when(null);
          }
          if (periodType == null) { periodType = PERIOD_TYPE.tpHours; }
          if (periodInterval == null) { periodInterval = 1; }

          resultType = (resultType == null) ? prepareResultMask({avg : true}) :
                                              prepareResultMask(resultType);
          if (resultType.ResultMask[0].length === 0) {
            resultType = prepareResultMask({avg : true});
          }

          return netCrunchConnection.queryTrendData(nodeID.toString(), counter, periodType,
                                                    periodInterval,
                                                    dateFrom, dateTo, resultType,
                                                    null, // day mask just no mask
                                                    null) // value for equal checking
            .then(function (data) {
              return {
                domain : calculateTimeDomain(dateFrom, periodType, periodInterval, data.trend.length),
                values : convertResultData(data, resultType)};
            });
        }

        function getCounterTrendRAWData (nodeID, counter, dateFrom, dateTo, resultType){
          return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpMinutes, 1, resultType);
        }

        function getCounterTrendMinutesData (nodeID, counter, dateFrom, dateTo, periodInterval, resultType){
          return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpMinutes,
                                     periodInterval, resultType);
        }

        function getCounterTrendHoursData (nodeID, counter, dateFrom, dateTo, periodInterval, resultType){
          return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpHours,
                                     periodInterval, resultType);
        }

        function getCounterTrendDaysData (nodeID, counter, dateFrom, dateTo, periodInterval, resultType){
          return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpDays,
                                     periodInterval, resultType);
        }

        function getCounterTrendMonthsData (nodeID, counter, dateFrom, dateTo, periodInterval, resultType){
          return getCounterTrendData(nodeID, counter, dateFrom, dateTo, PERIOD_TYPE.tpMonths,
                                     periodInterval, resultType);
        }

        function getCounterData (nodeID, counterName, dateStart, dateEnd, maxSampleCount, resultType, period) {
          var counterTrends = Object.create(null),
              result = Object.create(null);

          dateEnd = dateEnd || moment();
          maxSampleCount = maxSampleCount || netCrunchTrendDataProviderConsts.DEFAULT_MAX_SAMPLE_COUNT;
          period = period || calculateChartDataInterval(dateStart, dateEnd, maxSampleCount);

          counterTrends[PERIOD_TYPE.tpMinutes] = getCounterTrendMinutesData;
          counterTrends[PERIOD_TYPE.tpHours] = getCounterTrendHoursData;
          counterTrends[PERIOD_TYPE.tpDays] = getCounterTrendDaysData;
          counterTrends[PERIOD_TYPE.tpMonths] = getCounterTrendMonthsData;

          result.period = period;
          result.data = counterTrends[period.periodType](nodeID, counterName, dateStart, dateEnd,
                                                         period.periodInterval, resultType);
          return result;
        }

        function grafanaDataConverter (data) {
          return data.domain.map(function (time, $index) {
            return [data.values[$index], time.getTime()];
          });
        }

        return {
          PERIOD_TYPE : PERIOD_TYPE,
          QUERY_RESULT_MASKS : QUERY_RESULT_MASKS,
          calculateChartDataInterval : calculateChartDataInterval,
          calculateTimeDomain : calculateTimeDomain,
          prepareResultMask : prepareResultMask,
          getCounterTrendData : getCounterTrendData,
          getCounterTrendRAWData : getCounterTrendRAWData,
          getCounterTrendMinutesData : getCounterTrendMinutesData,
          getCounterTrendHoursData : getCounterTrendHoursData,
          getCounterTrendDaysData : getCounterTrendDaysData,
          getCounterTrendMonthsData : getCounterTrendMonthsData,
          getCounterData: getCounterData,
          grafanaDataConverter: grafanaDataConverter
        };
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
                self.counters = getCountersDataProvider();
                self.trends = getTrendDataProvider();
                if (ignoreDownloadNetworkAtlas !== true) {
                  self.networkAtlas.init().then(function() {
                    networkAtlasReady.resolve(self.networkAtlas);
                  });
                }
              });
            });
          });
        }

        function logout() {
          if (serverConnectionReady != null) {
            return serverConnectionReady.then(
              function() {
                var loggedOut = $q.defer();
                netCrunchClient.logout(function() {
                  loggedOut.resolve();
                });
                return loggedOut.promise;
              },
              function() {
                return $q.when();
              }
            );
          } else {
            return $q.when();
          }
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
          return new NetworkDataProvider(adrem, serverConnection, datasourceName);
        }

        function getCountersDataProvider() {
          return new CountersDataProvider(adrem, serverConnection);
        }

        function getTrendDataProvider() {
          return new TrendDataProvider(self);
        }

        function callApi (apiCall, args, acceptEmpty) {
          var def = $q.defer();
          acceptEmpty = (acceptEmpty === undefined) ? true : acceptEmpty;
          args = Array.prototype.slice.call(args, 0);       // convert arguments to Array
          apiCall.apply(self, args.concat([function (data) {
            if (data !== undefined || acceptEmpty) {
              def.resolve(data);
            } else {
              def.reject();
            }
          }]));
          return def.promise;
        }

        this.counters = Object.create(null);
        this.login = login;
        this.logout = logout;
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
    });
  });
