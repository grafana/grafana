define([
  'angular',
  'app/app',
  'lodash',
  'require',
  'app/features/panel/panel_meta',
],
function (angular, app, _, require, PanelMeta) {
  'use strict';

  var converter;

  var module = angular.module('grafana.panels.text', []);
  app.useModule(module);

  module.directive('grafanaPanelText', function() {
    return {
      controller: 'TextPanelCtrl',
      templateUrl: 'app/plugins/panels/text/module.html',
    };
  });

  module.controller('TextPanelCtrl', function($scope, templateSrv, $sce, panelSrv) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Text',
      editIcon:  "fa fa-text-width",
      fullscreen: true,
    });

    $scope.panelMeta.addEditorTab('Edit text', 'app/plugins/panels/text/editor.html');

    // Set and populate defaults
    var _d = {
      title   : 'default title',
      mode    : "markdown", // 'html', 'markdown', 'text'
      content : "",
      style: {},
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init($scope);
      $scope.ready = false;
      $scope.render();
    };

    $scope.refreshData = function() {
      $scope.panelMeta.loading = false;
      $scope.render();
    };

    $scope.render = function() {
      if ($scope.panel.mode === 'markdown') {
        $scope.renderMarkdown($scope.panel.content);
      }
      else if ($scope.panel.mode === 'html') {
        $scope.updateContent($scope.panel.content);
      }
      else if ($scope.panel.mode === 'text') {
        $scope.renderText($scope.panel.content);
      }
      $scope.panelRenderingComplete();
    };

    $scope.renderText = function(content) {
      content = content
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;')
        .replace(/\n/g, '<br/>');

      $scope.updateContent(content);
    };

    $scope.renderMarkdown = function(content) {
      var text = content
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;');

      if (converter) {
        $scope.updateContent(converter.makeHtml(text));
      }
      else {
        require(['vendor/showdown'], function (Showdown) {
          converter = new Showdown.converter();
          $scope.updateContent(converter.makeHtml(text));
        });
      }
    };

    $scope.updateContent = function(html) {
      try {
        $scope.content = $sce.trustAsHtml(templateSrv.replace(html, $scope.panel.scopedVars));
      } catch(e) {
        console.log('Text panel error: ', e);
        $scope.content = $sce.trustAsHtml(html);
      }

      if(!$scope.$$phase) {
        $scope.$digest();
      }
    };

    $scope.openEditor = function() {
    };

    $scope.init();
  });
});
