define([
  'angular',
  'lodash',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('TemplateEditorCtrl', function($scope, datasourceSrv, templateSrv, templateValuesSrv, alertSrv, playlistSrv) {

    var replacementDefaults = {
      type: 'query',
      datasource: null,
      refresh_on_load: false,
      name: '',
      options: [],
      includeAll: false,
      allFormat: 'glob',
      multi: false,
      multiFormat: 'glob',
    };

    $scope.init = function() {
      $scope.mode = 'list';

      $scope.datasources = _.filter(datasourceSrv.getMetricSources(), function(ds) {
        return !ds.meta.builtIn;
      });

      $scope.variables = templateSrv.variables;
      $scope.reset();

      $scope.$watch('mode', function(val) {
        if (val === 'new') {
          $scope.reset();
        }
      });

      $scope.$watch('current.datasource', function(val) {
        if ($scope.mode === 'new') {
          datasourceSrv.get(val).then(function(ds) {
            if (ds.meta.defaultMatchFormat) {
              $scope.current.allFormat = ds.meta.defaultMatchFormat;
              $scope.current.multiFormat = ds.meta.defaultMatchFormat;
            }
          });
        }
      });

      $scope.playlist = [];
      $scope.timespan = config.playlist_timespan;
      $scope.loadVariableList();
    };

    $scope.add = function() {
      if ($scope.isValid()) {
        $scope.variables.push($scope.current);
        $scope.update();
        $scope.updateSubmenuVisibility();
      }
    };

    $scope.isValid = function() {
      if (!$scope.current.name) {
        $scope.appEvent('alert-warning', ['Validation', 'Template variable requires a name']);
        return false;
      }

      if (!$scope.current.name.match(/^\w+$/)) {
        $scope.appEvent('alert-warning', ['Validation', 'Only word and digit characters are allowed in variable names']);
        return false;
      }

      var sameName = _.findWhere($scope.variables, { name: $scope.current.name });
      if (sameName && sameName !== $scope.current) {
        $scope.appEvent('alert-warning', ['Validation', 'Variable with the same name already exists']);
        return false;
      }

      return true;
    };

    $scope.runQuery = function() {
      return templateValuesSrv.updateOptions($scope.current).then(function() {
      }, function(err) {
        alertSrv.set('Templating', 'Failed to run query for variable values: ' + err.message, 'error');
      });
    };

    $scope.edit = function(variable) {
      $scope.current = variable;
      $scope.currentIsNew = false;
      $scope.mode = 'edit';

      if ($scope.current.datasource === void 0) {
        $scope.current.datasource = null;
        $scope.current.type = 'query';
        $scope.current.allFormat = 'glob';
      }
    };

    $scope.update = function() {
      if ($scope.isValid()) {
        $scope.runQuery().then(function() {
          $scope.reset();
          $scope.mode = 'list';
        });
      }
    };

    $scope.reset = function() {
      $scope.currentIsNew = true;
      $scope.current = angular.copy(replacementDefaults);
    };

    $scope.typeChanged = function () {
      if ($scope.current.type === 'interval') {
        $scope.current.query = '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d';
      }
      if ($scope.current.type === 'query') {
        $scope.current.query = '';
      }
    };

    $scope.removeVariable = function(variable) {
      var index = _.indexOf($scope.variables, variable);
      $scope.variables.splice(index, 1);
      $scope.updateSubmenuVisibility();
    };

    $scope.filterList = function() {
      $scope.filteredList = _.reject($scope.variableList, function(variable) {
        return _.findWhere($scope.playlist, {name: variable.name});
      });
    };

    $scope.loadVariableList = function() {
      $scope.variableList = $scope.variables;
      $scope.filterList();
    };

    $scope.addVariableToFilterList = function(variable) {
      $scope.playlist.push(variable);
      $scope.filterList();
    };

    $scope.removeVariableFromFilterList = function(variable) {
      $scope.playlist = _.without($scope.playlist, variable);
      $scope.filterList();
    };

    $scope.start = function() {
      $scope.playlistCombinations = $scope.computeCombinations($scope.playlist);
      playlistSrv.start("templateVariable",$scope.playlistCombinations, $scope.timespan);
    };

    $scope.computeCombinations = function(playlist) {
      var playlistCombinations = [];
      for(var i=0; i<playlist[0].options.length; i++) {
        playlistCombinations.push({dashboardSlug: $scope.dashboard.meta.slug,
        variableCombinations: [{tagName: playlist[0].name, tagValue: playlist[0].options[i].text}]});
      }
      for(var j=1; j<playlist.length; j++) {
        playlistCombinations = $scope.combineVariables(playlistCombinations, playlist[j]);
      }
      return playlistCombinations;
    };

    $scope.combineVariables = function(playlistCombinations, nextVariable) {
      var tempCombinations = [];
      for(var k=0,i=0; i<playlistCombinations.length; i++) {
        for(var j=0; j<nextVariable.options.length; j++,k++) {
          var temp = { dashboardSlug: playlistCombinations[i].dashboardSlug, variableCombinations:
          [{tagName: nextVariable.name, tagValue: nextVariable.options[j].text}]};
          temp.variableCombinations = temp.variableCombinations.concat(playlistCombinations[i].variableCombinations);
          tempCombinations.push(temp);
        }
      }
      return tempCombinations;
    };

  });

});
