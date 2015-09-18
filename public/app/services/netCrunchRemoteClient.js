define([
    'angular',
    'NCObjects',
    'remoteDataLists'
  ],

  function (angular) {

    'use strict';

    /* global adrem */

    var module = angular.module('grafana.services'),
        NETCRUNCH_SERVER_CONNECTION_DISABLED_INFO = 'NetCrunch server connection was disabled';

    // This factory establish connection with NetCrunch Web App Server
    module
      .value('adrem', adrem)
      .factory('netCrunchRemoteClient', function ($q, $rootScope, $http, $timeout, adrem, backendSrv, alertSrv) {
        var clientReadyTask = $q.defer(),
            clientReady = clientReadyTask.promise,
            netCrunchServerSettings;

        netCrunchServerSettings = backendSrv.get('api/netcrunch').then(function(settings) {
          var netCrunchWebAppApiName = '///' + settings.api + '/';

          if (settings.enable === true) {
            adrem.useWebSockets = false;
            adrem.Client.start(netCrunchWebAppApiName, function () {
              clientReadyTask.resolve();
            });
          } else {
            alertSrv.set('NetCrunch datasource', NETCRUNCH_SERVER_CONNECTION_DISABLED_INFO, 'info');
            clientReadyTask.reject();
          }

          return settings;
        });

        return {
          ready: clientReady,
          serverSettings: netCrunchServerSettings,
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
