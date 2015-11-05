define([
  'angular',
  'lodash'
],
function (angular,_) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('IdMapEditorCtrl', function($scope, datasourceSrv) {

    this.init = function() {
      this.datasources = datasourceSrv.getIdMapSources();

      this.idMapping = $scope.dashboard.idMapping;
      if (_.isEmpty(this.idMapping)) {
        this.idMapping.enabled = false;
        this.idMapping.datasource = this.datasources[0].name;
        this.idMapping.idField = "id";
        this.idMapping.nameField = "name";
      }

      this.onDataSourceChanged();
    };

    this.update = function() {
      $scope.broadcastRefresh();
    };

    this.onDataSourceChanged = function () {
      var self = this;
      datasourceSrv.get(this.idMapping.datasource).then(function(datasource) {
        self.isElasticDataSource = datasource.meta.name === "Elasticsearch";
      });
    };

    this.init();
  });

  module.directive('gfIdMapSettings', function() {
    return {
      restrict: 'E',
      templateUrl: 'app/features/idmaps/partials/settings.html',
      controller: 'IdMapEditorCtrl',
      bindToController: true,
      controllerAs: 'ctrl'
    };
  });

});
