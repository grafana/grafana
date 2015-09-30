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
      $scope.filteredHits = _.reject($scope.searchHits, function(element) {
        return _.findWhere($scope.playlist, {uri: element.uri});
      });
    };

    $scope.addElement = function(element) {
      $scope.playlist.push(element);
      if ($scope.playlistType === 'dashboards') {
        $scope.filterHits();
      }
      else if ($scope.playlistType === 'variables') {
        $scope.playlist = [];
        $scope.playlist[0] = element;
        $scope.filteredHits = [];
        $scope.variableList = [];
        var uriSplit = element.uri.split("/");
        backendSrv.getDashboard(uriSplit[0],uriSplit[1]).then(function(results) {
          $scope.variableList = results.dashboard.templating.list;
          $scope.filterList();
        });
      }
    };

    $scope.removeElement = function(element) {
      $scope.playlist = _.without($scope.playlist, element);
      $scope.filterHits();
    };

    $scope.filterList = function() {
      $scope.filteredList = _.reject($scope.variableList, function(variable) {
        return _.findWhere($scope.variables, {name: variable.name});
      });
    };

    $scope.addVariableToPlaylist = function(variable) {
      $scope.variables.push(variable);
      $scope.filterList();
    };

    $scope.removeVariableFromPlaylist = function(variable) {
      $scope.variables = _.without($scope.variables, variable);
      $scope.filterList();
    };

    $scope.start = function() {
      if($scope.playlistType === "variables") {
        $scope.playlistCombinations = $scope.computeCombinations($scope.variables);
        console.log($scope.playlistCombinations);
        playlistSrv.start($scope.playlistType, $scope.playlistCombinations, $scope.timespan);
      } else {
        playlistSrv.start($scope.playlistType, $scope.playlist, $scope.timespan);
      }
    };

    $scope.computeCombinations = function(variables) {
      var combinations = [];
      for(var i=0; i<variables[0].options.length; i++) {
        combinations.push({dashboardSlug: $scope.playlist[0].uri,
        varCombinations: [{tagName: variables[0].name, tagValue: variables[0].options[i].text}]});
      }
      for(var j=1; j<variables.length; j++) {
        combinations = $scope.combineVariables(combinations, variables[j]);
      }
      return combinations;
    };

    $scope.combineVariables = function(combinations, nextVariable) {
      var tempCombinations = [];
      for(var k=0,i=0; i<combinations.length; i++) {
        for(var j=0; j<nextVariable.options.length; j++,k++) {
          var temp = { dashboardSlug: combinations[i].dashboardSlug, varCombinations:
          [{tagName: nextVariable.name, tagValue: nextVariable.options[j].text}]};
          temp.varCombinations = temp.varCombinations.concat(combinations[i].varCombinations);
          tempCombinations.push(temp);
        }
      }
      return tempCombinations;
    };

  });

});
