/*jshint globalstrict:true */
/*global angular:true */
/*

  ## filtering

*/

'use strict';

angular.module('kibana.filtering', [])
.controller('filtering', function($scope, filterSrv, $rootScope, dashboard) {

  $scope.panelMeta = {
    status  : "Beta",
    description : "A controllable list of all filters currently applied to the dashboard. You "+
      "almost certainly want one of these on your dashboard somewhere."
  };

  // Set and populate defaults
  var _d = {
  };
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.filterSrv = filterSrv;
  };

  $scope.remove = function(id) {
    filterSrv.remove(id);
    dashboard.refresh();
  };

  $scope.toggle = function(id) {
    filterSrv.list[id].active = !filterSrv.list[id].active;
    dashboard.refresh();
  };

  $scope.refresh = function(query) {
    $rootScope.$broadcast('refresh');
  };

  $scope.render = function(query) {
    $rootScope.$broadcast('render');
  };

  $scope.show_key = function(key) {
    return !_.contains(['type','id','alias','mandate','active','editing'],key);
  };

});