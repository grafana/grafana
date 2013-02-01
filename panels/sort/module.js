angular.module('kibana.sort', [])
.controller('sort', function($scope, $rootScope) {

  // Set and populate defaults
  var _d = {
    query   : "*",
    size    : 100,
    sort    : [config.timefield,'desc'],
  }
  _.each(_d, function(v, k) {
    $scope.panel[k] = _.isUndefined($scope.panel[k]) 
      ? _d[k] : $scope.panel[k];
  });

  $scope.toggle_sort = function() {
    $scope.panel.sort[1] = $scope.panel.sort[1] == 'asc' ? 'desc' : 'asc';
  }

  $scope.fields = [];
  $scope.$on($scope.panel.group+"-fields", function(event, fields) {
    $scope.panel.sort = fields.sort;
    $scope.fields     = _.union(fields.all,$scope.fields);
  });
})