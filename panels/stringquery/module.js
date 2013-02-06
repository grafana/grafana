angular.module('kibana.stringquery', [])
.controller('stringquery', function($scope, $rootScope) {

  var _id = _.uniqueId();

  // Set and populate defaults
  var _d = {
    label   : "Search",
    query   : "*",
    size    : 100,
    sort    : [config.timefield,'desc'],
    group   : "default"
  }
  _.defaults($scope.panel,_d);

  var _groups = _.isArray($scope.panel.group) ? 
    $scope.panel.group : [$scope.panel.group];

  $scope.init = function() {
    $scope.send_query = function(query) {
      _.each(_groups,function(group) {
          $rootScope.$broadcast(group+"-query", query)
      });
    }    
  }
  $scope.init();
});