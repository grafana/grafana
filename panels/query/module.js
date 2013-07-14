/*

  ## query

  An experimental panel for the query service

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

angular.module('kibana.query', [])
.controller('query', function($scope, eventBus, query, $rootScope) {

  // Set and populate defaults
  var _d = {
    status  : "Experimental",
    label   : "Search",
    query   : "*",
    group   : "default",
    history : [],
    remember: 10 // max: 100, angular strap can't take a variable for items param
  }
  _.defaults($scope.panel,_d);

  $scope.queries = query;

  $scope.init = function() {
  }

  $scope.refresh = function(query) {
    $rootScope.$broadcast('refresh')
  }

  $scope.render = function(query) {
    $rootScope.$broadcast('render')
  }

  $scope.add_query = function() {
    if (_.isArray($scope.panel.query))
      $scope.panel.query.push("")
    else {
      $scope.panel.query = new Array($scope.panel.query)
      $scope.panel.query.push("")
    }
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