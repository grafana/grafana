angular.module('kibana.debug', [])
.controller('debug', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    group   : "ALL",
    style   : {'font-size':'9pt'},
    size   : 20
  }
  _.defaults($scope.panel,_d)
  
  $scope.init = function () {

    $scope.set_listeners($scope.panel.group)
    // Now that we're all setup, request the time from our group
    eventBus.broadcast($scope.$id,$scope.panel.group,"get_time")
  
    $scope.events = []
  }

  $scope.toggle_details = function(event) {
    event.details = event.details ? false : true;
  }

  $scope.set_listeners = function(group) {
    eventBus.register($scope,'$kibana_debug',function(event,data,header) {
      if($scope.events.length >= $scope.panel.size)
        $scope.events = $scope.events.slice(0,$scope.panel.size-1)

      $scope.events.unshift({header:header,data:data})
    });
  }

});