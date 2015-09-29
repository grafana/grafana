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
      $scope.filterHits();
    };

    $scope.removeElement = function(element) {
      $scope.playlist = _.without($scope.playlist, element);
      $scope.filterHits();
    };

    $scope.start = function() {
      playlistSrv.start($scope.playlistType, $scope.playlist, $scope.timespan);
    };

  });

});
