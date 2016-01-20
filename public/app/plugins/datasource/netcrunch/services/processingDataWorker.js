/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-08-26 14:34
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    var module = angular.module('grafana.services');

    module.factory('processingDataWorker', function ($q) {
      var taskQueue = [],
          taskProcessed,
          workerFile = 'public/app/plugins/datasource/netcrunch/workers/netCrunchProcessingDataWorker.js',
          webWorker = new Worker(workerFile);

      webWorker.addEventListener('message', function(event) {
        if (taskProcessed != null) {
          taskProcessed.defer.resolve(event.data.result);
          taskProcessed = null;
          processTask();
        }
      });

      function processTask() {
        if ((taskQueue.length > 0) && (taskProcessed == null)) {
          taskProcessed = taskQueue.shift();
          webWorker.postMessage(taskProcessed.data);
        }
      }

      function executeWorkerTask(data){
        var defer = $q.defer();

        taskQueue.push({defer: defer, data: data});
        processTask();
        return defer.promise;
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
