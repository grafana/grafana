/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.controllers', [])
.controller('DashCtrl', function($scope, $location, $http, $timeout, ejsResource) {


  $scope.config = config;
  $scope.dashboards = dashboards
  $scope.timespan = config.timespan
  $scope.time = {
    from : time_ago($scope.timespan),
    to   : new Date()
  }

  // I'm leaving in all this refresh stuff until I figure out how index
  // list caching should work. Maybe it should be handled by each time panel?
  // That would require dashboard to contain a time panel. Hmm.
  $scope.counter = 0;
  $scope.playing = true;
  $scope.play = function(){
    $scope.counter++;
    $scope.time.to = new Date();
    $scope.time.from = time_ago($scope.timespan);
    $scope.$root.$eval() 
    mytimeout = $timeout($scope.play,config.refresh);
  }

  $scope.pause = function(){
    if($scope.playing) {
      $scope.playing = false;
      $timeout.cancel(mytimeout);
    } else {
      $scope.playing = true;
      mytimeout = $timeout($scope.play,config.refresh);
    }
  }
  var mytimeout = $timeout($scope.play,config.refresh);

  // If from/to to change, update index list
  $scope.$watch(function() { 
    return angular.toJson([$scope.time.from, $scope.time.to]) 
  }, function(){
    indices($scope.time.from,$scope.time.to).then(function (p) {
      $scope.index = p.join();
    });
  });

  // point to your ElasticSearch server
  var ejs = $scope.ejs = ejsResource(config.elasticsearch);  

  $scope.toggle_row = function(row) {
    $scope.$broadcast('toggle_row',row)
    row.collapse = row.collapse ? false : true;
  }

  $scope.set_timespan = function(timespan) {
    $scope.timespan = timespan;
    $scope.time.from = time_ago($scope.timespan);
  }

  // returns a promise containing an array of all indices matching the index
  // pattern that exist in a given range
  function indices(from,to) {
    var possible = [];
    _.each(date_range(from,to.add_days(1)),function(d){
      possible.push(d.format(config.indexpattern));
    });

    return all_indices().then(function(p) {
      return _.intersection(p,possible);
    })
  };

  // returns a promise containing an array of all indices in an elasticsearch
  // cluster
  function all_indices() {
    var something = $http({
      url: config.elasticsearch + "/_aliases",
      method: "GET"
    }).error(function(data, status, headers, config) {
      $scope.error = status;
    });

    return something.then(function(p) {
      var indices = [];
      _.each(p.data, function(v,k) {
        indices.push(k)
      });
      return indices;
    });
  }
  
});



























