/*

  ## Better maps

  So the cavaet for this panel is that, for better or worse, it does NOT use the terms facet and it
  DOES query sequentially. This however means that

  ### Parameters
  * query ::  A single query string, not and array. This panel can only handle one
              query at a time. 
  * size :: How many results to show, more results = slower
  * field :: field containing a 2 element array in the format [lon,lat]
  * tooltip :: field to extract the tool tip value from
  * spyable :: Show the 'eye' icon that reveals the last ES query

  ### Group Events
  #### Sends
  * get_time :: On panel initialization get time range to query
  #### Receives
  * time :: An object containing the time range to use and the index(es) to query
  * query :: An Array of queries, this panel uses only the first one
*/

angular.module('kibana.bettermap', [])
.controller('bettermap', function($scope, eventBus, query) {

  // Set and populate defaults
  var _d = {
    status  : "Experimental",
    query   : "*",
    size    : 1000,
    spyable : true,
    tooltip : "_id",
    field   : null,
    group   : "default"
  }
  _.defaults($scope.panel,_d)

  $scope.init = function() {

    $scope.$on('refresh',function(){
      $scope.get_data();
    })

    eventBus.register($scope,'time', function(event,time){set_time(time)});

    // Now that we're all setup, request the time from our group
    eventBus.broadcast($scope.$id,$scope.panel.group,'get_time')
  }

$scope.get_data = function(segment,query_id) {
    $scope.panel.error =  false;

    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.index) || _.isUndefined($scope.time))
      return

    if(_.isUndefined($scope.panel.field)) {
      $scope.panel.error = "Please select a field that contains geo point in [lon,lat] format"
      return
    }
    
    //$scope.panel.loading = true;

    var _segment = _.isUndefined(segment) ? 0 : segment
    $scope.segment = _segment;

    var boolQuery = ejs.BoolQuery();
    _.each(query.list,function(q) {
      boolQuery = boolQuery.should(ejs.QueryStringQuery((q.query || '*') + " AND _exists_:"+$scope.panel.field))
    })

    var request = $scope.ejs.Request().indices($scope.index[_segment])
      .query(ejs.FilteredQuery(
        boolQuery,
        ejs.RangeFilter($scope.time.field)
          .from($scope.time.from)
          .to($scope.time.to)
        )
      )
      .fields([$scope.panel.field,$scope.panel.tooltip])
      .size($scope.panel.size)
      .sort($scope.time.field,'desc');

    $scope.populate_modal(request)

    var results = request.doSearch()

    // Populate scope when we have results
    results.then(function(results) {
      $scope.panel.loading = false;

      if(_segment === 0) {
        $scope.hits = 0;
        $scope.data = [];
        query_id = $scope.query_id = new Date().getTime()
      }

      // Check for error and abort if found
      if(!(_.isUndefined(results.error))) {
        $scope.panel.error = $scope.parse_error(results.error);
        return;
      }

      // Check that we're still on the same query, if not stop
      if($scope.query_id === query_id) {

        var scripts = $LAB.script("panels/bettermap/lib/leaflet.js").wait()

        scripts.wait(function(){
          $scope.data = $scope.data.concat(_.map(results.hits.hits, function(hit) {
            return {
              coordinates : new L.LatLng(hit.fields[$scope.panel.field][1],hit.fields[$scope.panel.field][0]),
              tooltip : hit.fields[$scope.panel.tooltip]
            }
          }));
        });
        // Keep only what we need for the set
        $scope.data = $scope.data.slice(0,$scope.panel.size)

      } else {
        return;
      }
  
      $scope.$emit('draw')

      // Get $size results then stop querying
      if($scope.data.length < $scope.panel.size && _segment+1 < $scope.index.length)
        $scope.get_data(_segment+1,$scope.query_id)

    });
  }

  // I really don't like this function, too much dom manip. Break out into directive?
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

})
.directive('bettermap', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      elem.html('<center><img src="common/img/load_big.gif"></center>')

      // Receive render events
      scope.$on('draw',function(){
        render_panel();
      });

      scope.$on('render', function(){
        if(!_.isUndefined(map)) {
          map.invalidateSize();
          var panes = map.getPanes()
        }
      })

      var map, markers, layerGroup, mcg;

      function render_panel() { 
        scope.panel.loading = false;

        var scripts = $LAB.script("panels/bettermap/lib/leaflet.js").wait()
          .script("panels/bettermap/lib/plugins.js")
   
        //add markers dynamically
        scripts.wait(function(){
          if(_.isUndefined(map)) {
            map = L.map(attrs.id, {
              scrollWheelZoom: false,
              center: [40, -86],
              zoom: 10
            });

            L.tileLayer('http://{s}.tile.cloudmade.com/57cbb6ca8cac418dbb1a402586df4528/22677/256/{z}/{x}/{y}.png', {
              maxZoom: 18,
              minZoom: 2
            }).addTo(map);
            layerGroup = new L.MarkerClusterGroup({maxClusterRadius:30});
          } else {
            layerGroup.clearLayers();
          }

          _.each(scope.data, function(p) {
            if(!_.isUndefined(p.tooltip) && p.tooltip !== '')
              layerGroup.addLayer(L.marker(p.coordinates).bindLabel(p.tooltip))
            else
              layerGroup.addLayer(L.marker(p.coordinates))
          })

          layerGroup.addTo(map)

          map.fitBounds(_.pluck(scope.data,'coordinates'));
        })
      }
    }
  };
});