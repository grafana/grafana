angular.module('kibana.table', [])
.controller('table', function($scope, eventBus) {

  var _id = _.uniqueId();

  // Set and populate defaults
  var _d = {
    query   : "*",
    size    : 100,
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
      set_time(time)
    });
    eventBus.register($scope,'query',function(event,query) {
      $scope.panel.query = query;
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

  $scope.get_data = function() {
    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.panel.index) || _.isUndefined($scope.panel.time))
      return

    var request = $scope.ejs.Request().indices($scope.panel.index);

    var results = request
      .query(ejs.FilteredQuery(
        ejs.QueryStringQuery($scope.panel.query || '*'),
        ejs.RangeFilter(config.timefield)
          .from($scope.panel.time.from)
          .to($scope.panel.time.to)
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
      $scope.all_fields = get_all_fields(results);

      broadcast_fields();
    });
  }

  // Broadcast a list of all fields. Note that receivers of field array 
  // events should be able to receive from multiple sources, merge, dedupe 
  // and sort on the fly if needed.
  function broadcast_fields() {
    eventBus.broadcast($scope.$id,$scope.panel.group,"fields", {
      all   : $scope.all_fields,
      sort  : $scope.panel.sort,
      active: $scope.panel.fields      
    });
  }

  function set_time(time) {
    $scope.panel.time = time;
    $scope.panel.index = _.isUndefined(time.index) ? $scope.panel.index : time.index
    $scope.get_data();
  }

  $scope.init();

});