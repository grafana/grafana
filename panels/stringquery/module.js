/*

  ## Stringquery

  Broadcasts a query object to other panels

  ### Parameters
  * label ::  The label to stick over the field 
  * query ::  A string or an array of querys. String if multi is off, array if it is on
              This should be fixed, it should always be an array even if its only 
              one element
  * multi :: Allow input of multiple queries? true/false
  * multi_arrange :: How to arrange multu query string panels, 'vertical' or 'horizontal'
  ### Group Events
  #### Sends
  * query :: Always broadcast as an array, even in multi: false
  #### Receives
  * query :: An array of queries. This is probably needs to be fixed.

*/

angular.module('kibana.stringquery', [])
.controller('stringquery', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    status  : "Stable",
    label   : "Search",
    query   : "*",
    group   : "default",
    multi   : false,
    multi_arrange: 'horizontal',
    history : [],
    remember: 10 // max: 100, angular strap can't take a variable for items param
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    // If we're in multi query mode, they all get wiped out if we receive a 
    // query. Query events must be exchanged as arrays.
    eventBus.register($scope,'query',function(event,query) {
      $scope.panel.query = query;
      update_history(query);
    });   
  }

  $scope.send_query = function(query) {
    var _query = _.isArray(query) ? query : [query];
    update_history(_query);
    eventBus.broadcast($scope.$id,$scope.panel.group,'query',_query);
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
  }

  var update_history = function(query) {
    if($scope.panel.remember > 0) {
      $scope.panel.history = _.union(query.reverse(),$scope.panel.history)
      var _length = $scope.panel.history.length
      if(_length > $scope.panel.remember) {
        $scope.panel.history = $scope.panel.history.slice(0,$scope.panel.remember)
      }
    }
  }

});