angular.module('kibana.sort', [])
.controller('sort', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    label   : "Sort",
    sort    : [config.timefield,'desc'],
    group   : "default"
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.fields = [];
    eventBus.register($scope,'fields',function(event, fields) {
      $scope.panel.sort = _.clone(fields.sort);
      $scope.fields     = _.union(fields.all,$scope.fields);
    });
  }

  $scope.set_sort = function() {
    eventBus.broadcast($scope.$id,$scope.panel.group,"sort",$scope.panel.sort)
  }

  $scope.toggle_sort = function() {
    $scope.panel.sort[1] = $scope.panel.sort[1] == 'asc' ? 'desc' : 'asc';
    $scope.set_sort();
  }

  $scope.init();
})