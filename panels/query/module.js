/*jshint globalstrict:true */
/*global angular:true */
/*

  ## query

  ### Parameters
  * label ::  The label to stick over the field
  * query ::  A string or an array of querys. String if multi is off, array if it is on
              This should be fixed, it should always be an array even if its only
              one element
*/

'use strict';

angular.module('kibana.query', [])
.controller('query', function($scope, querySrv, $rootScope) {

  $scope.panelMeta = {
    status  : "Stable",
    description : "Manage all of the queries on the dashboard. You almost certainly need one of "+
      "these somewhere. This panel allows you to add, remove, label, pin and color queries"
  };

  // Set and populate defaults
  var _d = {
    label   : "Search",
    query   : "*",
    pinned  : true,
    history : [],
    remember: 10 // max: 100, angular strap can't take a variable for items param
  };
  _.defaults($scope.panel,_d);

  $scope.querySrv = querySrv;

  $scope.init = function() {
  };

  $scope.refresh = function(query) {
    update_history(_.pluck($scope.querySrv.list,'query'));
    $rootScope.$broadcast('refresh');
  };

  $scope.render = function(query) {
    $rootScope.$broadcast('render');
  };

  $scope.toggle_pin = function(id) {
    querySrv.list[id].pin = querySrv.list[id].pin ? false : true;
  };

  var update_history = function(query) {
    if($scope.panel.remember > 0) {
      $scope.panel.history = _.union(query.reverse(),$scope.panel.history);
      var _length = $scope.panel.history.length;
      if(_length > $scope.panel.remember) {
        $scope.panel.history = $scope.panel.history.slice(0,$scope.panel.remember);
      }
    }
  };

  $scope.init();

});