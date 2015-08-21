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
    'config'
  ],

  function (angular, _, config) {

    'use strict';

    /* global angular, adrem, console */

    var module = angular.module('grafana.services');

    // This factory begin session with NetCrunch Web App Server
    module
      .factory('netCrunchRemoteSession', function ($q, $rootScope, $http, netCrunchRemoteClient, adrem) {

        var error = {msg: ''},
            loginInProgress = false,
            that;

        function getNetCrunchDatasourceById(id) {
          var dataSources = config.datasources,
              dataSourceName;

          dataSourceName = Object.keys(dataSources).filter(function(dataSourceName){
            return ((dataSources[dataSourceName].type === 'netcrunch') &&
                    (dataSources[dataSourceName].id === id));
          });
          return (dataSourceName != null) ? dataSources[dataSourceName] : null;
        }

        adrem.Client.on('exception', function (e) {
          error.msg = "Server Error. Please click on Refresh button in browser to restart application. "
                      + "(" + e.message + ")";
          $rootScope.$apply();
        });

        that = {
          init: function () {
            return netCrunchRemoteClient.ready.then(function () {
              var NETCRUNCH_DATASOURCE_ID = 0,  //Support is only for one NetCrunch datasource with ID=0
                  login,
                  dataSource;

              dataSource = getNetCrunchDatasourceById(NETCRUNCH_DATASOURCE_ID);
              login = ((dataSource == null)||(loginInProgress === true)) ? $q.when(false) : $q.when(true);

              if ((loginInProgress === false) && (dataSource != null) &&
                  (adrem.Client.status.logged === false) && ('Session' in adrem.Client)) {
                loginInProgress = true;
                login = $q(function (resolve, reject) {
                  adrem.Client.login(dataSource.username, dataSource.password, function (status) {
                    loginInProgress = false;
                    if (status) {
                      resolve(true);
                    } else {
                      reject(false);
                    }
                  });
                });

              }

              return $q.all([login]);
            });
          },
          error: error
        };

        return that;
      });
    });
