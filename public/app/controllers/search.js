define([
  'angular',
  'lodash',
  'config',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SearchCtrl', function($scope, $location, $timeout, backendSrv) {

    $scope.init = function() {
      $scope.giveSearchFocus = 0;
      $scope.selectedIndex = -1;
      $scope.results = [];
      $scope.query = { query: '', tag: '', starred: false };
      $scope.currentSearchId = 0;

      if ($scope.dashboardViewState.fullscreen) {
        $scope.exitFullscreen();
      }

      $timeout(function() {
        $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
        $scope.query.query = '';
        $scope.search();
      }, 100);
    };

    $scope.keyDown = function (evt) {
      if (evt.keyCode === 27) {
        $scope.dismiss();
      }
      if (evt.keyCode === 40) {
        $scope.moveSelection(1);
      }
      if (evt.keyCode === 38) {
        $scope.moveSelection(-1);
      }
      if (evt.keyCode === 13) {
        if ($scope.tagMode) {
          var tag = $scope.results[$scope.selectedIndex];
          if (tag) {
            $scope.filterByTag(tag.term);
          }
          return;
        }

        var selectedDash = $scope.results[$scope.selectedIndex];
        if (selectedDash) {
          $location.search({});
          $location.path(selectedDash.url);
        }
      }
    };

    $scope.moveSelection = function(direction) {
      var max = ($scope.results || []).length;
      var newIndex = $scope.selectedIndex + direction;
      $scope.selectedIndex = ((newIndex %= max) < 0) ? newIndex + max : newIndex;
    };

    $scope.searchDashboards = function() {
      $scope.tagsMode = false;
      $scope.currentSearchId = $scope.currentSearchId + 1;
      var localSearchId = $scope.currentSearchId;

      return backendSrv.search($scope.query).then(function(results) {
        if (localSearchId < $scope.currentSearchId) { return; }

        $scope.results = _.map(results, function(dash) {
          dash.url = 'dashboard/' + dash.uri;
          return dash;
        });

        if ($scope.queryHasNoFilters()) {
          $scope.results.unshift({ title: 'Home', url: config.appSubUrl + '/', type: 'dash-home' });
        }
      });
    };

    $scope.queryHasNoFilters = function() {
      var query = $scope.query;
      return query.query === '' && query.starred === false && query.tag === '';
    };

    $scope.filterByTag = function(tag, evt) {
      $scope.query.tag = tag;
      $scope.query.tagcloud = false;
      $scope.search();
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      if (evt) {
        evt.stopPropagation();
        evt.preventDefault();
      }
    };

    $scope.getTags = function() {
      return backendSrv.get('/api/dashboards/tags').then(function(results) {
        $scope.tagsMode = true;
        $scope.results = results;
        $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      });
    };

    $scope.showStarred = function() {
      $scope.query.starred = !$scope.query.starred;
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      $scope.search();
    };

    $scope.search = function() {
      $scope.showImport = false;
      $scope.selectedIndex = 0;
      $scope.searchDashboards();
    };

    $scope.newDashboard = function() {
      $location.url('dashboard/new');
    };

  });

});
