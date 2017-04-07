define(['angular',
  'lodash',
  'jquery',
  'moment',
  'require',
  'app/core/config',
],
function (angular, _, $, moment, require, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ShareModalCtrl', function($scope, $rootScope, $location, $timeout, timeSrv, templateSrv, linkSrv) {

    $scope.options = { forCurrent: true, includeTemplateVars: true, theme: 'current' };
    $scope.editor = { index: $scope.tabIndex || 0};

    $scope.init = function() {
      $scope.modeSharePanel = $scope.panel ? true : false;

      $scope.tabs = [{title: 'Link', src: 'shareLink.html'}];

      if ($scope.modeSharePanel) {
        $scope.modalTitle = 'Share Panel';
        $scope.tabs.push({title: 'Embed', src: 'shareEmbed.html'});
      } else {
        $scope.modalTitle = 'Share';
      }

      if (!$scope.dashboard.meta.isSnapshot) {
        $scope.tabs.push({title: 'Snapshot', src: 'shareSnapshot.html'});
      }

      if (!$scope.dashboard.meta.isSnapshot && !$scope.modeSharePanel) {
        $scope.tabs.push({title: 'Export', src: 'shareExport.html'});
      }

      $scope.buildUrl();
    };

    $scope.buildUrl = function() {
      var baseUrl = $location.absUrl();
      var queryStart = baseUrl.indexOf('?');

      if (queryStart !== -1) {
        baseUrl = baseUrl.substring(0, queryStart);
      }

      var params = angular.copy($location.search());

      var range = timeSrv.timeRange();
      params.from = range.from.valueOf();
      params.to = range.to.valueOf();
      params.orgId = config.bootData.user.orgId;

      if ($scope.options.includeTemplateVars) {
        templateSrv.fillVariableValuesForUrl(params);
      }

      if (!$scope.options.forCurrent) {
        delete params.from;
        delete params.to;
      }

      if ($scope.options.theme !== 'current') {
        params.theme = $scope.options.theme;
      }

      if ($scope.modeSharePanel) {
        params.panelId = $scope.panel.id;
        params.fullscreen = true;
      } else {
        delete params.panelId;
        delete params.fullscreen;
      }

      $scope.shareUrl = linkSrv.addParamsToUrl(baseUrl, params);

      var soloUrl = baseUrl.replace(config.appSubUrl + '/dashboard/', config.appSubUrl + '/dashboard-solo/');
      delete params.fullscreen;
      delete params.edit;
      soloUrl = linkSrv.addParamsToUrl(soloUrl, params);

      $scope.iframeHtml = '<iframe src="' + soloUrl + '" width="450" height="200" frameborder="0"></iframe>';

      $scope.imageUrl = soloUrl.replace(config.appSubUrl + '/dashboard-solo/', config.appSubUrl + '/render/dashboard-solo/');
      $scope.imageUrl += '&width=1000';
      $scope.imageUrl += '&height=500';
      $scope.imageUrl += '&tz=UTC' + encodeURIComponent(moment().format("Z"));
    };

  });

  module.directive('clipboardButton',function() {
    return function(scope, elem) {
      require(['vendor/clipboard/dist/clipboard'], function(Clipboard) {
        scope.clipboard = new Clipboard(elem[0]);
      });

      scope.$on('$destroy', function() {
        if (scope.clipboard) {
          scope.clipboard.destroy();
        }
      });
    };
  });

});
