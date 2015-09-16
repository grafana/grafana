/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-08-26 14:34
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

/* global angular, console */

define([
    'angular',
    'lodash'
  ],

  function (angular) {

    'use strict';

    var module = angular.module('grafana.services');

    module.factory('processingDataWorker', function ($q) {
      var defer = null,
          workerFile = 'public/app/plugins/datasource/netcrunch/workers/netCrunchProcessingDataWorker.js',
          webWorker = new Worker(workerFile);

      webWorker.addEventListener('message', function(event){
        if (defer != null) {
          defer.resolve(event.data.result);
          defer = null;
        }
      });

      function executeWorkerTask(data){
        if (defer == null) {
          defer = $q.defer();
          webWorker.postMessage(data);
          return defer.promise;
        } else {
          return $q.reject('Processing data worker busy.');
        }
      }

      return {
        filterAndOrderMapNodes : function (nodeList, selectedMap) {
          return executeWorkerTask({method : 'filterAndOrderMapNodes',
            nodeList: nodeList,
            selectedMap : selectedMap});
        }
      };
    });

});
