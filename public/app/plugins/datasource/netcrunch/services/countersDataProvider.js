/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-06-18
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    var module = angular.module('grafana.services');

    module
      .factory('countersDataProvider', function($q, adrem, netCrunchCounters, netCrunchCounterConsts) {
        var ncCounters = netCrunchCounters,
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
              trendDB = new adrem.TrendDB('ncSrv', '');
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
            var monitorMgrInf = new adrem.MonitorMgrIntf('ncSrv'),
                deferred = $q.defer();

            monitorMgrInf.getMonitorsInfo({}, function(monitors) {
              deferred.resolve(monitorMgrInf.convertMonitorsInfoListToMap(monitors));
            });
            return deferred.promise;
          }
        };
      });
  });
