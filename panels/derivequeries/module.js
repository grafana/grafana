/*

  ## Termsquery

  Broadcasts an array of queries based on the results of a terms facet

  ### Parameters
  * label :: The label to stick over the field 
  * query :: A string to use as a filter for the terms facet
  * field :: the field to facet on
  * size :: how many queries to generate
  * fields :: a list of fields known to us
  * query_mode :: how to create query
  
  ### Group Events
  #### Sends
  * query :: Always broadcast as an array, even in multi: false
  * get_time :: Request the time object from the timepicker
  #### Receives
  * query :: An array of queries. This is probably needs to be fixed.
  * time :: populate index and time
  * fields :: A list of fields known to us
*/

angular.module('kibana.derivequeries', [])
.controller('derivequeries', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    status  : "Beta",
    label   : "Search",
    query   : "*",
    group   : "default",
    field   : '_type',
    fields  : [],
    spyable : true,
    size    : 5,
    mode    : 'terms only',
    exclude : []
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    eventBus.register($scope,'fields', function(event, fields) {
      $scope.panel.fields = fields.all;
    });
    eventBus.register($scope,'time', function(event,time){set_time(time)});
    eventBus.register($scope,'query', function(event, query) {
      $scope.panel.query = _.isArray(query) ? query[0] : query;
      $scope.get_data();
    });
    // Now that we're all setup, request the time from our group
    eventBus.broadcast($scope.$id,$scope.panel.group,'get_time')
  }

  $scope.get_data = function() {
    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.index) || _.isUndefined($scope.time))
      return

    $scope.panel.loading = true;
    var request = $scope.ejs.Request().indices($scope.index);

    // Terms mode
    request = request
      .facet(ejs.TermsFacet('query')
        .field($scope.panel.field)
        .size($scope.panel['size'])
        .exclude($scope.panel.exclude)
        .facetFilter(ejs.QueryFilter(
          ejs.FilteredQuery(
            ejs.QueryStringQuery($scope.panel.query || '*'),
            ejs.RangeFilter($scope.time.field)
              .from($scope.time.from)
              .to($scope.time.to)
            )))).size(0)

    $scope.populate_modal(request);

    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.panel.loading = false;
      var data = [];
      if ($scope.panel.query === '' || $scope.panel.mode === 'terms only') {
        var suffix = '';
      } else if ($scope.panel.mode === 'AND') {
        var suffix = ' AND (' + $scope.panel.query + ')';
      } else if ($scope.panel.mode === 'OR') {
        var suffix = ' OR (' + $scope.panel.query + ')';
      }
      _.each(results.facets.query.terms, function(v) {
        data.push($scope.panel.field+':"'+v.term+'"'+suffix)
      });
      $scope.send_query(data)
    });
  }

  $scope.set_refresh = function (state) { 
    $scope.refresh = state; 
  }

  $scope.close_edit = function() {
    if($scope.refresh)
      $scope.get_data();
    $scope.refresh =  false;
  }

  $scope.populate_modal = function(request) {
    $scope.modal = {
      title: "Inspector",
      body : "<h5>Last Elasticsearch Query</h5><pre>"+
          'curl -XGET '+config.elasticsearch+'/'+$scope.index+"/_search?pretty -d'\n"+
          angular.toJson(JSON.parse(request.toString()),true)+
        "'</pre>", 
    } 
  }

  function set_time(time) {
    $scope.time = time;
    $scope.index = _.isUndefined(time.index) ? $scope.index : time.index
    $scope.get_data();
  }

  $scope.send_query = function(query) {
    var _query = _.isArray(query) ? query : [query]
    eventBus.broadcast($scope.$id,$scope.panel.group,'query',_query)
  }



});
