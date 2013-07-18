/*

  ## filtering

  An experimental for interacting with the filter service

  ### Parameters

*/

angular.module('kibana.filtering', [])
.controller('filtering', function($scope, filterSrv, $rootScope, dashboard) {

  // Set and populate defaults
  var _d = {
    status  : "Experimental"
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.filterSrv = filterSrv
  }

  $scope.remove = function(id) {
    filterSrv.remove(id);
    dashboard.refresh();
  }

  $scope.toggle = function(id) {
    filterSrv.list[id].active = !filterSrv.list[id].active;
    dashboard.refresh();
  }

  $scope.refresh = function(query) {
    $rootScope.$broadcast('refresh')
  }

  $scope.render = function(query) {
    $rootScope.$broadcast('render')
  }

  $scope.show_key = function(key) {
    return !_.contains(['type','id','alias','mandate','active','editing'],key)
  }

});