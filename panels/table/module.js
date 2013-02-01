angular.module('kibana.table', [])
.controller('table', function($scope, $rootScope, $location) {

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

  // Events which this panel receives and sends
  if (!(_.isUndefined($scope.panel.group))) {
    // Receives these events
    $scope.$on($scope.panel.group+"-query", function(event, query) {
      $scope.panel.query = query;
      $scope.get_data();
    });
  }

  $scope.toggle_sort = function() {
    $scope.panel.sort[1] = $scope.panel.sort[1] == 'asc' ? 'desc' : 'asc';
  }

  $scope.get_data = function() {
    var request = $scope.ejs.Request().indices($scope.index);

    var results = request
      .query(ejs.FilteredQuery(
        ejs.QueryStringQuery($scope.panel.query || '*'),
        ejs.RangeFilter(config.timefield)
          .from($scope.from)
          .to($scope.to)
          .cache(false)
        )
      )
      .size($scope.panel.size)
      .sort($scope.panel.sort[0],$scope.panel.sort[1])
      .doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      if(_.isUndefined(results)) {
        $scope.panel.error = 'Your query was unsuccessful';
        return;
      }
      $scope.panel.error =  false;
      $scope.hits = results.hits.total;
      $scope.data = results.hits.hits;

      // Broadcast a list of all fields. Note that receivers of field array 
      // events should be able to receive from multiple sources, merge, dedupe 
      // and sort on the fly.
      if (!(_.isUndefined($scope.panel.group)))
        $rootScope.$broadcast(
          $scope.panel.group+"-fields", {
            all   : get_all_fields(results),
            sort  : $scope.panel.sort
          });  
    });
  }

  $scope.$watch(function() { 
    return angular.toJson([$scope.from, $scope.to, $scope.panel.sort]) 
  }, function(){
    $scope.get_data();
  });

})
