define([
    'angular',
    'NCObjects',
    'remoteDataLists'
  ],

  function (angular) {

    'use strict';

    /* global adrem */

    var module = angular.module('grafana.services');

    // This factory establish connection with NetCrunch Web App Server
    module
      .value('adrem', adrem)
      .value('netCrunchWebAppApiName', '///ncapi/')
      .factory('netCrunchRemoteClient', function ($q, $rootScope, $http, $timeout, adrem,
                                                  netCrunchWebAppApiName) {
        var clientReadyTask = $q.defer(),
            clientReady = clientReadyTask.promise;

        adrem.useWebSockets = false;
        adrem.Client.start(netCrunchWebAppApiName, function () {
          clientReadyTask.resolve();
        });

        return {
          ready: clientReady,
          callApi: function (apiCall, args, acceptEmpty) {
            var def = $q.defer();
            acceptEmpty = (acceptEmpty === undefined) ? true : acceptEmpty;
            args = Array.prototype.slice.call(args, 0); // convert arguments to Array
            apiCall.apply(this, args.concat([function (data) {
              if (data !== undefined || acceptEmpty) {
                def.resolve(data);
              } else {
                def.reject();
              }
            }]));
            return def.promise;
          }
        };
      });
  });
