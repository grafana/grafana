angular.module('kibana.stringquery', [])
.controller('stringquery', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    label   : "Search",
    query   : "*",
    size    : 100,
    sort    : ['_score','desc'],
    group   : "default",
    multi   : false,
    multi_arrange: 'horizontal',
  }
  _.defaults($scope.panel,_d);

  var _groups = _.isArray($scope.panel.group) ? 
    $scope.panel.group : [$scope.panel.group];

  $scope.init = function() {
    eventBus.register($scope,'query',function(event,query) {
      $scope.panel.query = query;
    });   
  }

  $scope.send_query = function(query) {
    eventBus.broadcast($scope.$id,$scope.panel.group,'query',query)
  }

  $scope.add_query = function() {
    if (_.isArray($scope.panel.query))
      $scope.panel.query.push("")
    else {
      $scope.panel.query = new Array($scope.panel.query)
      $scope.panel.query.push("")
    }
  } 

  $scope.set_multi = function(multi) {
    $scope.panel.query = multi ? 
      new Array($scope.panel.query) : $scope.panel.query[0];
  }

  $scope.remove_query = function(index) {
    $scope.panel.query.splice(index,1);
    console.log($scope.panel.query)
  }

  $scope.init();
});