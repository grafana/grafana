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

    // I don't like this compromise. I'm not totally sure what this panel
    // Should do if its in multi query mode and receives a query. For now, just
    // replace the first one, though I feel like that isn't right.
    eventBus.register($scope,'query',function(event,query) {
      if (_.isArray($scope.panel.query))
        $scope.panel.query[0] = query
      else
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

  $scope.set_sort = function(field) {
    if($scope.panel.sort[0] === field)
      $scope.panel.sort[1] = $scope.panel.sort[1] == 'asc' ? 'desc' : 'asc';
    else
      $scope.panel.sort[0] = field;
  }

  $scope.remove_query = function(index) {
    $scope.panel.query.splice(index,1);
    console.log($scope.panel.query)
  }

  $scope.init();
});