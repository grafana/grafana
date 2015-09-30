define([
  'angular',
  'lodash',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PlaylistCtrl', function($scope, playlistSrv, backendSrv) {

    $scope.init = function() {
      $scope.playlist = [];
      $scope.variables = [];
      $scope.playlistType = 'dashboards'; //default option is playlist of dashboards.
      $scope.timespan = config.playlist_timespan;
      $scope.search();
    };

    $scope.search = function() {
      var query = {starred: true, limit: 10};

      if ($scope.searchQuery) {
        query.query = $scope.searchQuery;
        query.starred = false;
      }

      backendSrv.search(query).then(function(results) {
        $scope.searchHits = results;
        $scope.filterHits();
      });
    };

    $scope.filterHits = function() {
      $scope.filteredHits = _.reject($scope.searchHits, function(dashboard) {
        return _.findWhere($scope.playlist, {uri: dashboard.uri});
      });
    };

    $scope.addDashboard = function(dashboard) {
      $scope.playlist.push(dashboard);
      if ($scope.playlistType === 'dashboards') {
        $scope.filterHits();
      }
      else if ($scope.playlistType === 'variables') {
        $scope.playlist = [];
        $scope.playlist[0] = dashboard;
        $scope.filteredHits = [];
        $scope.variableList = [];
        var uriSplit = dashboard.uri.split("/");
        backendSrv.getDashboard(uriSplit[0],uriSplit[1]).then(function(results) {
          $scope.variableList = results.dashboard.templating.list;
          $scope.filterList();
        });
      }
    };

    $scope.removeElement = function(dashboard) {
      $scope.playlist = _.without($scope.playlist, dashboard);
      $scope.filterHits();
    };

    $scope.filterList = function() {
      $scope.filteredList = _.reject($scope.variableList, function(variable) {
        return _.findWhere($scope.variables, {name: variable.name});
      });
    };

    $scope.addVariable = function(variable) {
      $scope.variables.push(variable);
      $scope.filterList();
    };

    $scope.removeVariable = function(variable) {
      $scope.variables = _.without($scope.variables, variable);
      $scope.filterList();
    };

    $scope.start = function() {
      if($scope.playlistType === "variables") {
        playlistSrv.start($scope.playlistType, $scope.computeCombinations($scope.variables), $scope.timespan);
      } else if($scope.playlistType === "dashboards") {
        playlistSrv.start($scope.playlistType, $scope.playlist, $scope.timespan);
      }
    };

    $scope.computeCombinations = function(variables) {
      var combinations = [];
      for(var i=0; i<variables[0].options.length; i++) {
        combinations.push({uri: $scope.playlist[0].uri,
        list: [{tagName: variables[0].name, tagValue: variables[0].options[i].text}]});
      }
      for(var j=1; j<variables.length; j++) {
        combinations = $scope.combineVariableOptions(combinations, variables[j]);
      }
      return combinations;
    };

    $scope.combineVariableOptions = function(combinations, nextVariable) {
      var tempCombinations = [];
      for(var k=0,i=0; i<combinations.length; i++) {
        for(var j=0; j<nextVariable.options.length; j++,k++) {
          var temp = { uri: combinations[i].uri,
          list: [{tagName: nextVariable.name, tagValue: nextVariable.options[j].text}]};
          temp.list = temp.list.concat(combinations[i].list);
          tempCombinations.push(temp);
        }
      }
      return tempCombinations;
    };

  });

});
