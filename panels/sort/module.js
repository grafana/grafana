/*

  ## Sort

  This will probably be removed in the near future since it only interacts with 
  the table panel and the table panel already implements all of its functionality.
  It only interacts with the table panel in any case

  ### Parameters
  * label ::  The label to stick over the drop down
  * sort :: An array where the first elemetn is the field to sort on an the second
            is the direction ('asc' or 'desc')
  ### Group Events
  #### Sends
  * sort :: An array where the first elemetn is the field to sort on an the second
            is the direction ('asc' or 'desc')
  #### Receives
  * fields :: An array containing the fields in a table. This will be concat'd + 
              uniqued with the curent list. 

*/

angular.module('kibana.sort', [])
.controller('sort', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    label   : "Sort",
    sort    : ['_score','desc'],
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
})