angular.module('kibana.sort', [])
.controller('sort', function($scope, $rootScope) {

  var _id = _.uniqueId();

  // Set and populate defaults
  var _d = {
    label   : "Sort",
    query   : "*",
    size    : 100,
    sort    : [config.timefield,'desc'],
    group   : "default"
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.fields = [];
    $scope.$on($scope.panel.group+"-fields", function(event, fields) {
      $scope.panel.sort = _.clone(fields.sort);
      $scope.fields     = _.union(fields.all,$scope.fields);
    });
  }

  $scope.set_sort = function() {
    $rootScope.$broadcast($scope.panel.group+"-sort",$scope.panel.sort)
  }

  $scope.toggle_sort = function() {
    $scope.panel.sort[1] = $scope.panel.sort[1] == 'asc' ? 'desc' : 'asc';
    $rootScope.$broadcast($scope.panel.group+"-sort",$scope.panel.sort)
  }
  $scope.init();
})