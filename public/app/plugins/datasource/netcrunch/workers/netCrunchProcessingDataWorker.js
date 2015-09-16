/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-05-29
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

/* global postMessage, importScripts, netCrunchCommonFilters */

(function () {

  'use strict';

  importScripts('../filters/netCrunchCommonFilters.js');

  function filterAndOrderMapNodes(nodeList, selectedMap) {
    var resultNodeList;

    resultNodeList = netCrunchCommonFilters.mapNodes(nodeList, selectedMap);
    if (resultNodeList != null) {
      return netCrunchCommonFilters.orderNodes(resultNodeList);
    } else {
      return [];
    }
  }

  function executeFilterAndOrderMapNodes(nodeList, selectedMap) {
    postMessage({
      result : filterAndOrderMapNodes(nodeList, selectedMap)
    });
  }

  addEventListener('message', function(event) {
    switch (event.data.method) {
      case 'filterAndOrderMapNodes' :
        executeFilterAndOrderMapNodes(event.data.nodeList, event.data.selectedMap);
        break;
    }
  }, false);
})();
