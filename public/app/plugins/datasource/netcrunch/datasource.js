/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-08-20
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

define([
  'angular',
  'lodash',
  'moment',
  'config',
  'jquery',
  'kbn',
  './services/networkDataProvider',
  './services/countersDataProvider',
  './services/trendDataProvider',
  './services/processingDataWorker',
  './controllers/netCrunchQueryCtrl',
  './controllers/netCrunchOptionsCtrl',
  './filters/netCrunchFilters'
],

function (angular, _, moment) {

  'use strict';

  var module = angular.module('grafana.services');

  module.factory('NetCrunchDatasource', function($q, $rootScope, alertSrv, adrem,
                                                 netCrunchTrendDataProviderConsts,
                                                 netCrunchRemoteSession, networkDataProvider,
                                                 atlasTree, countersDataProvider, trendDataProvider,
                                                 netCrunchOrderNodesFilter, netCrunchMapNodesFilter,
                                                 netCrunchNodesFilter, processingDataWorker) {

    var THREAD_WORKER_NODES_NUMBER = 1000,
        RAW_DATA_MAX_RANGE = {
          periodInterval : 2,
          periodType : 'days'
        },
        RAW_TIME_RANGE_EXCEEDED_WARNING_TITLE = 'Time range is too long.',
        RAW_TIME_RANGE_EXCEEDED_WARNING_TEXT = 'Maximum allowed length of time range for RAW data is '
                                               + RAW_DATA_MAX_RANGE.periodInterval + ' ' +
                                                 RAW_DATA_MAX_RANGE.periodType + '.',
        TEMPLATES_NOT_SUPPORTED_INFO = 'NetCrunch datasource doesn\'t support templates.',
        SERIES_TYPES_DISPLAY_NAMES = {
          min : 'Min',
          avg : 'Avg',
          max : 'Max',
          avail : 'Avail',
          delta : 'Delta',
          equal : 'Equal',
          distr : 'Distr'
        },
        PERIODS = Object.create(null);

    PERIODS[trendDataProvider.PERIOD_TYPE.tpMinutes] = 'minutes';
    PERIODS[trendDataProvider.PERIOD_TYPE.tpHours] = 'hours';
    PERIODS[trendDataProvider.PERIOD_TYPE.tpDays] = 'days';
    PERIODS[trendDataProvider.PERIOD_TYPE.tpMonths] = 'months';

    function QueryCache(datasource) {
      this.datasource = datasource;
      this.cache = Object.create(null);
      this.cache.counters = Object.create(null);
    }

    QueryCache.prototype.getCounters = function (nodeId) {
      var countersCache = this.cache.counters,
          cachedNodeCounters = countersCache[nodeId],
          countersQuery;

      if (cachedNodeCounters != null) {
        return cachedNodeCounters.data;
      } else {
        countersQuery = this.datasource.getCounters(nodeId);
        countersCache[nodeId] = {
          timestamp: moment(),
          data: countersQuery
        };
        return countersQuery;
      }
    };

    function NetCrunchDatasource(datasource) {

      var initTask = $q.defer(),
          nodesReady = $q.defer(),
          networkAtlasReady = $q.defer(),
          self = this;

      this.id = datasource.id;
      this.name = datasource.name;
      this.url = datasource.url;
      this.username = datasource.username;
      this.password = datasource.password;
      this.ready = initTask.promise;
      this.nodes = nodesReady.promise;
      this.networkAtlas = networkAtlasReady.promise;
      this.cache = this.createQueryCache();

      netCrunchRemoteSession.init().then(

        function(status) {
          var LOGIN_STATUS_ID = 0;

          if (status[LOGIN_STATUS_ID] === true) {
            networkDataProvider.init().then(function() {

              $rootScope.$on('host-data-changed', function() {
                var nodes = atlasTree.nodes;

                nodes.table = [];
                Object.keys(nodes).forEach(function(nodeId) {
                  nodes.table.push(nodes[nodeId]);
                });

                self.updateNodeList(nodes.table).then(function(updated) {
                  nodesReady.resolve(updated);
                  $rootScope.$broadcast('netCrunch-datasource-hosts-changed');
                });
              });

              $rootScope.$on('network-data-changed', function() {
                networkAtlasReady.resolve(atlasTree.tree);
                $rootScope.$broadcast('netCrunch-datasource-network-atlas-changed');
              });

              initTask.resolve();
            });
          } else {
            console.log('NetCrunch datasource: login failed');
            alertSrv.set('NetCrunch datasource' ,'Can\'t connect to the server', 'error');
            initTask.reject();
          }
        },

        function() {
          initTask.reject();
        });
    }

    NetCrunchDatasource.prototype.createQueryCache = function() {
      return new QueryCache(this);
    };

    NetCrunchDatasource.prototype.testDatasource = function() {
      var defer = $q.defer();

      if ((adrem.ncSrv != null) && (adrem.Client.loggedIn === true)) {
        defer.resolve({ status: "success", message: "Data source connection is working",
                        title: "Success" });
        return defer.promise;
      } else {
        return $q.when({ status: "error", message: "Data source connection is not working",
                         title: "Error" });
      }
    };

    NetCrunchDatasource.prototype.getNodeById = function (nodeID) {
      return this.nodes.then(function(nodes) {
        return nodes.nodesMap[nodeID];
      });
    };

    NetCrunchDatasource.prototype.getCounters = function (nodeId) {
      return this.ready.then(function() {
        return countersDataProvider.getCounters(nodeId).then(function(counters) {
          return countersDataProvider.prepareCountersForMonitors(counters).then(function(counters) {

            counters.table = [];
            Object.keys(counters).forEach(function(monitorID) {
              if (monitorID > 0) {
                counters[monitorID].counters.forEach(function(counter) {
                  counters.table.push(counter);
                });
              }
            });

            return counters;
          });
        });
      });
    };

    NetCrunchDatasource.prototype.getCountersFromCache = function(nodeId) {
      return this.cache.getCounters(nodeId);
    };

    NetCrunchDatasource.prototype.findCounterByName = function(counters, counterName) {
      var existingCounter = null;

      counters.table.some(function(counter) {
        if (counter.name === counterName) {
          existingCounter = counter;
          return true;
        } else {
          return false;
        }
      });

      return existingCounter;
    };

    NetCrunchDatasource.prototype.filterNodeList = function(nodes, pattern) {

      var newNodeList = [],
        result = $q.when(newNodeList);

      function orderNodeList(nodes) {
        if (nodes != null) {
          return netCrunchOrderNodesFilter(nodes);
        } else {
          return [];
        }
      }

      if (nodes != null) {
        if (nodes.length < THREAD_WORKER_NODES_NUMBER) {
          newNodeList = netCrunchMapNodesFilter(nodes, null);
          newNodeList = orderNodeList(newNodeList);
          newNodeList = netCrunchNodesFilter(newNodeList, pattern);
          result = $q.when(newNodeList);
        } else {
          return processingDataWorker.filterAndOrderMapNodes(nodes, null).then(function(result) {
            return netCrunchNodesFilter(result, pattern);
          });
        }
      }

      return result;
    };

    NetCrunchDatasource.prototype.updateNodeList = function(nodes) {
      return this.filterNodeList(nodes, '').then(function(updated) {
        updated.nodesMap = Object.create(null);
        updated.forEach(function(node) {
          updated.nodesMap[node.values.Id] = node;
        });
        return updated;
      });
    };

    NetCrunchDatasource.prototype.validateSeriesTypes = function(series) {
      series.min = (series.min == null) ? false : series.min;
      series.avg = (series.avg == null) ? true : series.avg;
      series.max = (series.max == null) ? false : series.max;
      series.avail = (series.avail == null) ? false : series.avail;
      series.delta = (series.delta == null) ? false : series.delta;
      series.equal = (series.equal == null) ? false : series.equal;
      series.distr = (series.distr == null) ? false : series.distr;
      return series;
    };

    NetCrunchDatasource.prototype.seriesTypesSelected = function(series) {
      return Object.keys(series).some(function(seriesKey) {
        return (series[seriesKey] === true);
      });
    };

    NetCrunchDatasource.prototype.updatePanel = function(panel) {
      var MAX_SAMPLE_COUNT = netCrunchTrendDataProviderConsts.DEFAULT_MAX_SAMPLE_COUNT,
          scopedVars = (panel.scopedVars == null) ? Object.create(null) : panel.scopedVars,
          rawData = (scopedVars.rawData == null) ? false : scopedVars.rawData,
          setMaxDataPoints = (scopedVars.setMaxDataPoints == null) ? false : scopedVars.setMaxDataPoints,
          maxDataPoints = (scopedVars.maxDataPoints == null) ? MAX_SAMPLE_COUNT :
                           scopedVars.maxDataPoints;

      panel.scopedVars = scopedVars;
      panel.scopedVars.rawData = rawData;
      panel.scopedVars.setMaxDataPoints = setMaxDataPoints;
      panel.scopedVars.maxDataPoints = maxDataPoints;
      return panel;
    };

    NetCrunchDatasource.prototype.query = function(options) {
      var self = this;

      function floorTime(time, period) {
        var MINUTES_SLOT = 5,
            minuteRemains,
            floorMethod = Object.create(null);

        floorMethod['minutes'] = function (time) {
          minuteRemains = time.minute() % MINUTES_SLOT;
          return time.subtract(minuteRemains, 'minutes');
        };

        floorMethod['hours'] = function (time) {
          return time.startOf('hour');
        };

        floorMethod['days'] = function (time) {
          return time.startOf('day');
        };

        floorMethod['months'] = function (time) {
          return time.startOf('month');
        };

        return floorMethod[period](time).startOf('minute');
      }

      function addMarginsToTimeRange (rangeFrom, rangeTo, period) {

        rangeFrom = moment(rangeFrom).subtract(period.periodInterval, PERIODS[period.periodType]);
        rangeTo = moment(rangeTo).add(period.periodInterval, PERIODS[period.periodType]);

        if (rangeTo > moment()) {
          rangeTo = moment();
        }

        return {
          from : floorTime(rangeFrom, PERIODS[period.periodType]),
          to : rangeTo,
          periodInterval : period.periodInterval,
          periodType : period.periodType
        };
      }

      function calculateTimeRange(rangeFrom, rangeTo, maxDataPoints) {
        var period = trendDataProvider.calculateChartDataInterval(rangeFrom, rangeTo, maxDataPoints);
        return addMarginsToTimeRange(rangeFrom, rangeTo, period);
      }

      function calculateRAWTimeRange(rangeFrom, rangeTo) {
        var period = {
          periodInterval : 1,
          periodType : trendDataProvider.PERIOD_TYPE.tpMinutes
        };
        return addMarginsToTimeRange(rangeFrom, rangeTo, period);
      }

      function calculateMaxDataPoints (setMaxDataPoints, maxDataPoints) {
        var maxDataPointsInt,
            minMaxDataPoints = netCrunchTrendDataProviderConsts.DEFAULT_MIN_MAX_SAMPLE_COUNT,
            maxMaxDataPoints = netCrunchTrendDataProviderConsts.DEFAULT_MAX_MAX_SAMPLE_COUNT,
            result = netCrunchTrendDataProviderConsts.DEFAULT_MAX_SAMPLE_COUNT;

        function isNumber(value) {
          return !isNaN(parseFloat(value)) && isFinite(value);
        }

        if ((setMaxDataPoints === true) && (isNumber(maxDataPoints) === true)) {
          maxDataPointsInt = Math.round(parseFloat(maxDataPoints));
          if ((maxDataPointsInt >= minMaxDataPoints) && (maxDataPointsInt <= maxMaxDataPoints)) {
            result = maxDataPointsInt;
          }
        }

        return result;
      }

      function prepareTimeRange (rangeFrom, rangeTo, rawData, maxDataPoints) {
        var range = null;

        if (rawData === true) {
          if (moment(rangeTo).subtract(RAW_DATA_MAX_RANGE.periodInterval,
                                       RAW_DATA_MAX_RANGE.periodType) <= rangeFrom) {
            range = calculateRAWTimeRange(rangeFrom, rangeTo);
          } else {
            alertSrv.set(RAW_TIME_RANGE_EXCEEDED_WARNING_TITLE,
                         RAW_TIME_RANGE_EXCEEDED_WARNING_TEXT, 'warning');
          }
        } else {
          range = calculateTimeRange(rangeFrom, rangeTo, maxDataPoints);
        }

        return range;
      }

      function validateCounterData(target) {
        var nodeName,
            counterDisplayName;

        nodeName = self.nodes.then(function(nodesData) {
          var nodeData = nodesData.nodesMap[target.nodeID];
          return (nodeData != null) ? nodeData.values.Name : null;
        });

        counterDisplayName = self.getCountersFromCache(target.nodeID).then(function(counters) {
          var counterData = self.findCounterByName(counters, target.counterName);
          return (counterData != null) ? counterData.displayName : null;
        });

        return $q.all([nodeName, counterDisplayName]).then(function(counterData) {
          var nodeName = counterData[0],
              counterDisplayName = counterData[1];

          if ((nodeName == null) || (counterDisplayName == null)) {
            return null;
          } else {
            return {
              nodeName : nodeName,
              counterDisplayName : counterDisplayName
            };
          }
        });
      }

      function prepareSeriesDataQuery (target, range, series){

        if (self.seriesTypesSelected(series) === false) {
          return $q.when([]);
        }

        return trendDataProvider.getCounterTrendData(target.nodeID, target.counterName, range.from,
                                                     range.to, range.periodType, range.periodInterval,
                                                     series)
          .then(function (dataPoints) {
            var seriesData = [];

            Object.keys(dataPoints.values).forEach(function(seriesType) {
              seriesData.push({
                seriesType: seriesType,
                dataPoints: {
                  domain: dataPoints.domain,
                  values: dataPoints.values[seriesType]
                }
              });
            });

            return seriesData;
          });
      }

      function prepareTargetQuery (target, range, series) {
        var targetDataQuery = null;

        if ((target.hide !== true) && (target.counterDataComplete === true)) {
          targetDataQuery = validateCounterData(target).then(function(counterData) {
            var query = null,
                seriesDataQuery,
                seriesTypes;

            if (counterData != null) {
              query = [$q.when(counterData.nodeName + ' - ' + counterData.counterDisplayName)];
              seriesTypes = (series == null) ? Object.create(null) : series;
              seriesTypes = self.validateSeriesTypes(seriesTypes);
              seriesDataQuery = prepareSeriesDataQuery(target, range, seriesTypes);
              query.push(seriesDataQuery);
              query = $q.all(query);
            }

            return query;
          });
        }

        return targetDataQuery;
      }

      function prepareChartData(targetsChartData, rawData) {
        var counterSeries = Object.create(null);

        function extendCounterName(baseCounterName, seriesType) {
          return baseCounterName + '\\' + SERIES_TYPES_DISPLAY_NAMES[seriesType];
        }

        counterSeries.data = [];

        if ((targetsChartData != null) && (targetsChartData.length > 0)) {
          targetsChartData.forEach(function(target) {
            var baseCounterName = (target != null) ? target[0] : null,
                targetSeries = (target != null) ? target[1] : null,
                extendedNamesCounters = !rawData,
                counterName;

            if (target != null) {
              targetSeries.forEach(function(serie) {
                if (extendedNamesCounters === true) {
                  counterName = extendCounterName(baseCounterName, serie.seriesType);
                }  else {
                  counterName = baseCounterName;
                }
                counterSeries.data.push({
                  target: counterName,
                  datapoints: trendDataProvider.grafanaDataConverter(serie.dataPoints)
                });
              });
            }
          });
        }

        return counterSeries;
      }

      try {
        return this.ready.then(function() {
          var targets = options.targets || [],
              scopedVars = (options.scopedVars == null) ? {} : options.scopedVars,
              rawData = (scopedVars.rawData == null) ? false : scopedVars.rawData,
              setMaxDataPoints = (scopedVars.setMaxDataPoints == null) ? false :
                                  scopedVars.setMaxDataPoints,
              maxDataPoints = (scopedVars.maxDataPoints == null) ?
                               netCrunchTrendDataProviderConsts.DEFAULT_MAX_SAMPLE_COUNT :
                               scopedVars.maxDataPoints,
              rangeFrom = options.range.from.startOf('minute'),
              rangeTo = options.range.to.startOf('minute'),
              rangeMaxDataPoints = calculateMaxDataPoints(setMaxDataPoints, maxDataPoints),
              range = prepareTimeRange(rangeFrom, rangeTo, rawData, rangeMaxDataPoints),
              dataQueries = [];

          if (range != null) {
            targets.forEach(function(target) {
              var targetDataQuery,
                  series = (rawData === true) ? {avg : true} : target.series;

              targetDataQuery = prepareTargetQuery(target, range, series);
              if (targetDataQuery != null) {
                dataQueries.push(targetDataQuery);
              }
            });
          }

          return $q.all(dataQueries).then(function(targetsChartData) {
            return prepareChartData(targetsChartData, rawData);
          });

        }, function() {
          return $q.when(false);
        });
      }

      catch(error) {
        return $q.reject(error);
      }
    };

    NetCrunchDatasource.prototype.metricFindQuery = function() {
      alertSrv.set(TEMPLATES_NOT_SUPPORTED_INFO);
      return $q.when([]);
    };

    $rootScope.$on('netCrunch-datasource-hosts-changed', function() {});

    $rootScope.$on('netCrunch-datasource-network-atlas-changed', function() {});

    return NetCrunchDatasource;
  });
});
