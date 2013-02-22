angular.module('kibana.table', [])
.controller('table', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    query   : "*",
    size    : 100,
    offset  : 0,
    sort    : ['@timestamp','desc'],
    group   : "default",
    style   : {},
    fields  : [],
  }
  _.defaults($scope.panel,_d)

  $scope.init = function () {

    $scope.set_listeners($scope.panel.group)
    // Now that we're all setup, request the time from our group
    eventBus.broadcast($scope.$id,$scope.panel.group,"get_time")
  }

  $scope.set_listeners = function(group) {
    eventBus.register($scope,'time',function(event,time) {
      $scope.panel.offset = 0;
      set_time(time)
    });
    eventBus.register($scope,'query',function(event,query) {
      $scope.panel.offset = 0;
      $scope.panel.query = _.isArray(query) ? query[0] : query;
      $scope.get_data();
    });
    eventBus.register($scope,'sort', function(event,sort){
      $scope.panel.sort = _.clone(sort);
      $scope.get_data();
    });
    eventBus.register($scope,'selected_fields', function(event, fields) {
      $scope.panel.fields = _.clone(fields)
    });
  }

  $scope.set_sort = function(field) {
    if($scope.panel.sort[0] === field)
      $scope.panel.sort[1] = $scope.panel.sort[1] == 'asc' ? 'desc' : 'asc';
    else
      $scope.panel.sort[0] = field;
    $scope.get_data();
  }

  $scope.toggle_field = function(field) {
    if (_.indexOf($scope.panel.fields,field) > -1) 
      $scope.panel.fields = _.without($scope.panel.fields,field)
    else
      $scope.panel.fields.push(field)
    broadcast_fields();
  }

  $scope.toggle_details = function(row) {
    row.kibana = row.kibana || {};
    row.kibana.details = !row.kibana.details ? $scope.without_kibana(row) : false;
  }

  $scope.page = function(page) {
    $scope.panel.offset = page*$scope.panel.size
    $scope.get_data();
  }

  $scope.build_search = function(field, value,negate) {
    $scope.panel.query = add_to_query($scope.panel.query,field,value,negate)
    $scope.panel.offset = 0;
    $scope.get_data();
    eventBus.broadcast($scope.$id,$scope.panel.group,'query',$scope.panel.query);
  }

  $scope.get_data = function() {
    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.panel.index) || _.isUndefined($scope.time))
      return

    var request = $scope.ejs.Request().indices($scope.panel.index);

    var results = request
      .query(ejs.FilteredQuery(
        ejs.QueryStringQuery($scope.panel.query || '*'),
        ejs.RangeFilter($scope.time.field)
          .from($scope.time.from)
          .to($scope.time.to)
        )
      )
      .size($scope.panel.size)
      .from($scope.panel.offset)
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
      $scope.data = _.map(results.hits.hits, function(hit) {
        return flatten_json(hit['_source']);
      });
      $scope.all_fields = get_all_fields(results);

      broadcast_results();
    });
  }

  $scope.without_kibana = function (row) {
    row = _.clone(row)
    delete row.kibana
    return row
  } 

  // Broadcast a list of all fields. Note that receivers of field array 
  // events should be able to receive from multiple sources, merge, dedupe 
  // and sort on the fly if needed.
  function broadcast_results() {
    eventBus.broadcast($scope.$id,$scope.panel.group,"fields", {
      all   : $scope.all_fields,
      sort  : $scope.panel.sort,
      active: $scope.panel.fields      
    });
    eventBus.broadcast($scope.$id,$scope.panel.group,"table_documents", 
      {query:$scope.panel.query,docs:$scope.data});
  }

  function set_time(time) {
    $scope.time = time;
    $scope.panel.index = _.isUndefined(time.index) ? $scope.panel.index : time.index
    $scope.get_data();
  }

  $scope.init();

});