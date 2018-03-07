/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

/* eslint-disable no-shadow, no-param-reassign, object-shorthand, func-names */

import { NetCrunchCounters, NETCRUNCH_COUNTER_CONST } from '../adrem/module';
import { NetCrunchSessionCache } from './sessionCache';

function NetCrunchCountersData(adremClient, netCrunchServerConnection) {

  const
    COUNTERS_CACHE_SECTION = 'counters',
    COUNTERS_PATH_CACHE_SECTION = 'countersPath',
    MONITORS_CACHE_SECTION = 'monitors',
    ncCounters = new NetCrunchCounters(adremClient, netCrunchServerConnection),
    counterConsts = NETCRUNCH_COUNTER_CONST,
    cache = new NetCrunchSessionCache();

  let
    trendDB = null,
    trendDBReadyResolve,
    trendDBReadyReject,
    trendDBReady = new Promise((resolve, reject) => {         // eslint-disable-line
      trendDBReadyResolve = resolve;
      trendDBReadyReject = reject;
    }),
    monitorMgrInf = null,
    monitorMgrInfReadyResolve,
    monitorMgrInfReadyReject,
    monitorMgrInfReady = new Promise((resolve, reject) => {   // eslint-disable-line
      monitorMgrInfReadyResolve = resolve;
      monitorMgrInfReadyReject = reject;
    });

  cache.addSection(COUNTERS_CACHE_SECTION);
  cache.addSection(COUNTERS_PATH_CACHE_SECTION);
  cache.addSection(MONITORS_CACHE_SECTION);

  function addCountersToCache(nodeId, countersQuery) {
    cache.addToCache(COUNTERS_CACHE_SECTION, nodeId, countersQuery);
  }

  function getCountersFromCache(nodeId) {
    return cache.getFromCache(COUNTERS_CACHE_SECTION, nodeId);
  }

  function addDisplayCounterPathToCache(counterPath, displayCounterPathQuery) {
    cache.addToCache(COUNTERS_PATH_CACHE_SECTION, counterPath, displayCounterPathQuery);
  }

  function getDisplayCounterPathFromCache(counterPath) {
    return cache.getFromCache(COUNTERS_PATH_CACHE_SECTION, counterPath);
  }

  function addMonitorsToCache(monitorsQuery) {
    cache.addToCache(MONITORS_CACHE_SECTION, MONITORS_CACHE_SECTION, monitorsQuery);
  }

  function getMonitorsFromCache() {
    return cache.getFromCache(MONITORS_CACHE_SECTION, MONITORS_CACHE_SECTION);
  }

  return {

    prepareCountersForMonitors: function(counters, fromCache = true) {
      const
        counterPromises = [],
        self = this;

      let monitors = Object.create(null);

      function createCounterObject(counter, fromCache) {
        return self.convertCounterPathToDisplay(counter[1], fromCache)
          .then((displayName) => {              // eslint-disable-line
            return {
              name: counter[1],
              displayName
            };
          });
      }

      function compareCounters(counterA, counterB) {
        if (counterA.displayName < counterB.displayName) { return -1; }
        if (counterA.displayName > counterB.displayName) { return 1; }
        if (counterA.displayName === counterB.displayName) { return 0; }
        return 0;
      }

      function sortCounters(monitors) {
        Object.keys(monitors).forEach((monitorId) => {
          monitors[monitorId].counters.sort(compareCounters);
        });
        return monitors;
      }

      function updateMonitorNames(monitors, fromCache) {
        return self.getMonitors(fromCache)
          .then((monitorsMap) => {
            Object.keys(monitors).forEach((monitorId) => {
              if (monitorsMap[monitorId] != null) {
                monitors[monitorId].name = monitorsMap[monitorId].counterGroup;
              }
            });
            return monitors;
          });
      }

      counters.forEach((counter) => {
        if (monitors[counter[0]] == null) {
          monitors[counter[0]] = Object.create(null);
          monitors[counter[0]].counters = [];
        }

        monitors[counter[0]].counters.push(createCounterObject(counter, fromCache));
      });

      Object.keys(monitors).forEach((monitorId) => {
        counterPromises.push(
          Promise.all(monitors[monitorId].counters)
            .then((counters) => {
              monitors[monitorId].counters = counters;
            })
        );
      });

      return Promise.all(counterPromises)
        .then(() => {
          monitors = sortCounters(monitors);
          return updateMonitorNames(monitors, fromCache);
        });
    },

    getCounters: function(nodeId, fromCache = true) {
      let countersQuery;

      countersQuery = (fromCache) ? getCountersFromCache(nodeId) : null;

      if (countersQuery == null) {
        if (trendDB == null) {
          trendDB = new adremClient.NetCrunch.TrendDB('ncSrv', '', (status) => {
            if (status === true) {
              trendDBReadyResolve();
            } else {
              trendDBReadyReject();
            }
          }, netCrunchServerConnection);
        }

        countersQuery = trendDBReady
          .then(() =>
            new Promise((resolve) => {
              trendDB.getCounters({ machineId: nodeId }, (counters) => {

                // counters are in form [ "<monitorId>=<counter>", ... ]

                counters = counters.map(counter => counter.split('='));
                resolve(counters);
              });
            })
          );
        addCountersToCache(nodeId, countersQuery);
      }
      return countersQuery;
    },

    convertCounterPathToDisplay: function(counterPath, fromCache = true) {
      const parsedCounterPath = ncCounters.parseCounterPath(counterPath);
      let
        counterPathObject,
        counterPathToDisplayQuery;

      counterPathToDisplayQuery = (fromCache) ? getDisplayCounterPathFromCache(counterPath) : null;

      if (counterPathToDisplayQuery == null) {
        if (ncCounters.isMIBCnt(parsedCounterPath.obj, parsedCounterPath.cnt) === true) {
          counterPathObject = ncCounters.counterPathObject(counterPath, counterConsts.CNT_TYPE.cstMIB);
          counterPathToDisplayQuery = ncCounters.counterPathToDisplayStr(counterPathObject, true, true);
        } else {
          counterPathToDisplayQuery = ncCounters.counterPathToDisplayStr(counterPath, true, true);
        }
        addDisplayCounterPathToCache(counterPath, counterPathToDisplayQuery);
      }
      return counterPathToDisplayQuery;
    },

    getMonitors: function(fromCache = true) {
      let monitorsQuery;

      monitorsQuery = (fromCache) ? getMonitorsFromCache() : null;

      if (monitorsQuery == null) {
        if (monitorMgrInf == null) {
          monitorMgrInf = new adremClient.NetCrunch.MonitorMgrIntf('ncSrv', (status) => {
            if (status === true) {
              monitorMgrInfReadyResolve();
            } else {
              monitorMgrInfReadyReject();
            }
          }, netCrunchServerConnection);
        }

        monitorsQuery = monitorMgrInfReady
          .then(() =>
            new Promise((resolve) => {
              monitorMgrInf.getMonitorsInfo({}, (monitors) => {
                const monitorsMap = Object.create(null);

                monitors.forEach((monitor) => {
                  monitorsMap[monitor.monitorId] = monitor;
                });
                resolve(monitorsMap);
              });
            })
          );
        addMonitorsToCache(monitorsQuery);
      }

      return monitorsQuery;
    },

    getCountersForMonitors: function(nodeId, fromCache) {

      function getCountersTable(counters) {
        let countersTable = [];
        Object.keys(counters).forEach((monitorID) => {
          if (monitorID > 0) {
            countersTable = countersTable.concat(counters[monitorID].counters);
          }
        });
        return countersTable;
      }

      return this.getCounters(nodeId, fromCache)
        .then(counters => this.prepareCountersForMonitors(counters, fromCache))
        .then((counters) => {
          counters.table = getCountersTable(counters);
          return counters;
        });
    },

    findCounterByName: function(counters, counterName) {
      let foundCounter = null;

      counters.table.some((counter) => {
        if (counter.name === counterName) {
          foundCounter = counter;
          return true;
        }
        return false;
      });
      return foundCounter;
    }

  };
}

export {
  NetCrunchCountersData
};
