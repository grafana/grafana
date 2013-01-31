angular.module('kibana.table', [])
.controller('table', function($scope, $location) {

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
      console.log(results)
      $scope.hits = results.hits.total;
      $scope.data = results.hits.hits;
      /*
      _.each(results.facets.pie.terms, function(v) {
        var slice = { label : v.term, data : v.count }; 
        $scope.data.push();
        if(!(_.isUndefined($scope.panel.colors)) 
          && _.isArray($scope.panel.colors)
          && $scope.panel.colors.length > 0) {
          slice.color = $scope.panel.colors[k%$scope.panel.colors.length];
        } 
        $scope.data.push(slice)
        k = k + 1;
      });
*/
    });
  }

  $scope.$watch(function() { 
    return angular.toJson([$scope.from, $scope.to]) 
  }, function(){
    $scope.get_data();
  });

})