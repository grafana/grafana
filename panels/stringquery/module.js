angular.module('kibana.stringquery', [])
.controller('stringquery', function($scope, $rootScope) {

  // Set and populate defaults
  var _d = {
    label   : "Search",
    query   : "*",
    size    : 100,
    sort    : [config.timefield,'desc'],
  }
  _.each(_d, function(v, k) {
    $scope.panel[k] = _.isUndefined($scope.panel[k]) 
      ? _d[k] : $scope.panel[k];
  });

  if (!(_.isUndefined($scope.panel.group))) {
    $scope.send_query = function(query) {
      $rootScope.$broadcast($scope.panel.group+"-query", query)  
    }
  }
})