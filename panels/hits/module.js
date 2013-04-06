angular.module('kibana.hits', [])
.controller('hits', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    query   : "*",
    group   : "default",
    style   : { "font-size": '36pt'},
    aggregate   : true,
    arrangement : 'vertical'
  }
  _.defaults($scope.panel,_d)

  $scope.init = function () {
    $scope.hits = 0;
    eventBus.register($scope,'time', function(event,time){
      set_time(time)
    });
    eventBus.register($scope,'query', function(event, query) {
      $scope.panel.query = _.map(query,function(q) {
        return {query: q, label: q};
      })
      $scope.get_data();
    });
    // Now that we're all setup, request the time from our group
    eventBus.broadcast($scope.$id,$scope.panel.group,'get_time')
  }

  $scope.get_data = function(segment,query_id) {
    delete $scope.panel.error
    $scope.panel.loading = true;

    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.panel.index) || _.isUndefined($scope.time))
      return

    var _segment = _.isUndefined(segment) ? 0 : segment
    var request = $scope.ejs.Request().indices($scope.panel.index[_segment]);
    
    // Build the question part of the query
    var queries = [];
    _.each($scope.panel.query, function(v) {
      queries.push($scope.ejs.FilteredQuery(
        ejs.QueryStringQuery(v.query || '*'),
        ejs.RangeFilter($scope.time.field)
          .from($scope.time.from)
          .to($scope.time.to))
      )
    });

    // Build the facet part
    _.each(queries, function(v) {
      request = request
        .facet($scope.ejs.QueryFacet("query"+_.indexOf(queries,v))
          .query(v)
        ).size(0)
    })

    // TODO: Spy for hits panel
    //$scope.populate_modal(request);

    // Then run it
    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {

      $scope.panel.loading = false;
      if(_segment == 0) {
        $scope.hits = 0;
        $scope.data = [];
        query_id = $scope.query_id = new Date().getTime();
      }
      
      // Check for error and abort if found
      if(!(_.isUndefined(results.error))) {
        $scope.panel.error = $scope.parse_error(results.error);
        return;
      }
      if($scope.query_id === query_id) {
        var i = 0;
        _.each(results.facets, function(v, k) {
          var hits = _.isUndefined($scope.data[i]) || _segment == 0 ? 
            v.count : $scope.data[i].hits+v.count
          $scope.hits += v.count

          // Create series
          $scope.data[i] = { 
            label: $scope.panel.query[i].label || "query"+(parseInt(i)+1), 
            hits: hits
          };

          i++;
        });

        if(_segment < $scope.panel.index.length-1) 
          $scope.get_data(_segment+1,query_id)
      
      }
    });
  }

  $scope.remove_query = function(q) {
    $scope.panel.query = _.without($scope.panel.query,q);
    $scope.get_data();
  }

  $scope.add_query = function(label,query) {
    $scope.panel.query.unshift({
      query: query,
      label: label, 
    });
    $scope.get_data();
  }

  function set_time(time) {
    $scope.time = time;
    $scope.panel.index = _.isUndefined(time.index) ? $scope.panel.index : time.index
    $scope.get_data();
  }

})
