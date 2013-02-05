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

  $scope.init = function() {
    $scope.send_query = function(query) {
      $rootScope.$broadcast($scope.panel.group+"-query", query)  
    }
  }
  $scope.init();
});