/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-08-20
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

    // This factory begin session with NetCrunch Web App Server
    module
      .factory('netCrunchRemoteSession', function ($q, $rootScope, $http, netCrunchRemoteClient, adrem) {

        var error = {msg: ''},
            trendQuery,
            loginInProgress = false,
            loginInProgressPromise,
            that;

        adrem.Client.on('exception', function (e) {
          error.msg = "Server Error. Please click on Refresh button in browser to restart application. " +
                      "(" + e.message + ")";
          $rootScope.$apply();
        });

        that = {
          init: function () {
            return netCrunchRemoteClient.ready.then(
              function () {
                var loginProcess = $q.defer(),
                    login,
                    user,
                    password;

                login = (adrem.Client.Session == null) ? $q.when(false) : $q.when(true);

                if ((loginInProgress === false) && (adrem.Client.status.logged === false) &&
                    ('Session' in adrem.Client)) {
                  loginInProgress = true;
                  login = loginProcess.promise;
                  loginInProgressPromise = login;

                  netCrunchRemoteClient.serverSettings.then(function(settings) {
                    user = settings.user;
                    password = settings.password;
                    adrem.Client.login(user, password, function (status) {
                      loginInProgress = false;
                      loginProcess.resolve(status);
                    });
                  });
                }

                if (loginInProgress === true) {
                  login = loginInProgressPromise;
                }

                return $q.all([login]);
              },
              function() {
                return $q.reject(false);
              });
          },

          queryTrendData: function () {
            if (trendQuery == null) {
              trendQuery = new adrem.ncSrv.ITrendQuery();
            }
            return netCrunchRemoteClient.callApi(trendQuery.AnalyzeGetData, arguments);
          },

          error : error,
          res : {}
        };

        return that;
      });
  });
