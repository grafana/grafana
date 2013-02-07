/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.controllers', [])
.controller('DashCtrl', function($scope, $rootScope, ejsResource) {

  $scope.config = config;
  $scope.dashboards = dashboards

  var ejs = $scope.ejs = ejsResource(config.elasticsearch);  

  $scope.toggle_row = function(row) {
    $scope.$broadcast('toggle_row',row)
    row.collapse = row.collapse ? false : true;
  }

});



























