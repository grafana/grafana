angular.module('kibana.fields', [])
.controller('fields', function($scope, eventBus) {

  var _id = _.uniqueId();

  // Set and populate defaults
  var _d = {
    group   : "default",
    style   : {"font-size":"85%","line-height":"15px"},
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.fields = [];
    eventBus.register($scope,'fields', function(event, fields) {
      $scope.panel.sort = _.clone(fields.sort);
      $scope.fields     = _.union(fields.all,$scope.fields);
      $scope.active     = _.clone(fields.active);
    });
  }

  $scope.toggle_sort = function() {
    $scope.panel.sort[1] = $scope.panel.sort[1] == 'asc' ? 'desc' : 'asc';
  }

  $scope.toggle_field = function(field) {
    if (_.indexOf($scope.active,field) > -1) 
      $scope.active = _.without($scope.active,field)
    else
      $scope.active.push(field)
    
    eventBus.broadcast($scope.$id,$scope.panel.group,"selected_fields",$scope.active)
  }

  $scope.is_active = function(field) {
    return _.indexOf($scope.active,field) > -1 ? 'active' : '';    
  }

  $scope.init();
})