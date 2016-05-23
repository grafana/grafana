define([
  'angular',
  'lodash',
  'jquery'
],
function (angular, _, $) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AnnotationsEditorCtrl', function($scope, datasourceSrv) {
    var annotationDefaults = {
      name: '',
      datasource: null,
      iconColor: 'rgba(255, 96, 96, 1)',
      enable: true
    };

    $scope.init = function() {
      $scope.mode = 'list';
      $scope.datasources = datasourceSrv.getAnnotationSources();
      $scope.annotations = $scope.dashboard.annotations.list;
      $scope.reset();

      $scope.$watch('mode', function(newVal) {
        if (newVal === 'new') { $scope.reset(); }
      });
    };

    $scope.datasourceChanged = function() {
      return datasourceSrv.get($scope.currentAnnotation.datasource).then(function(ds) {
        $scope.currentDatasource = ds;
        $scope.currentAnnotation.datasource = $scope.currentAnnotation.datasource;
      });
    };

    $scope.edit = function(annotation) {
      $scope.currentAnnotation = annotation;
      $scope.currentIsNew = false;
      $scope.datasourceChanged();
      $scope.mode = 'edit';

      $(".tooltip.in").remove();
    };

    $scope.reset = function() {
      $scope.currentAnnotation = angular.copy(annotationDefaults);
      $scope.currentAnnotation.datasource = $scope.datasources[0].name;
      $scope.currentIsNew = true;
      $scope.datasourceChanged();
    };

    $scope.update = function() {
      $scope.reset();
      $scope.mode = 'list';
      $scope.broadcastRefresh();
    };

    $scope.add = function() {
      $scope.annotations.push($scope.currentAnnotation);
      $scope.reset();
      $scope.mode = 'list';
      $scope.updateSubmenuVisibility();
      $scope.broadcastRefresh();
    };

    $scope.removeAnnotation = function(annotation) {
      var index = _.indexOf($scope.annotations, annotation);
      $scope.annotations.splice(index, 1);
      $scope.updateSubmenuVisibility();
      $scope.broadcastRefresh();
    };

  });

});
