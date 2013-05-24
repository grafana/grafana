/*

  ## Map

  LOL. Should this even be documented? Zach's map panel is going to ruin this one. 
  For serious. This shades a map of the world, the US or Europe with the number of 
  events that match the query. Uses 2 letter country codes and nothing else. This uses
  a terms facet. Its probably safe as long as you point it at the right field. Nach.
  There's no way to query sequentially here, so I'm going to hit them all at once!

  ### Parameters
  * query ::  A single query string, not and array. This panel can only handle one
              query at a time. 
  * map :: 'world', 'us' or 'europe'
  * colors :: an array of colors to use for the regions of the map. If this is a 2 
              element array, jquerymap will generate shades between these colors 
  * size :: How big to make the facet. Higher = more countries
  * exclude :: Exlude the array of counties
  * spyable :: Show the 'eye' icon that reveals the last ES query
  * index_limit :: This does nothing yet. Eventually will limit the query to the first
                   N indices
  ### Group Events
  #### Sends
  * get_time :: On panel initialization get time range to query
  #### Receives
  * time :: An object containing the time range to use and the index(es) to query
  * query :: An Array of queries, this panel uses only the first one
*/

angular.module('kibana.map', [])
.controller('map', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    query   : "*",
    map     : "world",
    colors  : ['#A0E2E2', '#265656'],
    size    : 100,
    exclude : [],
    spyable : true,
    group   : "default",
    index_limit : 0
  }
  _.defaults($scope.panel,_d)

  $scope.init = function() {
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

    // Then the insert into facet and make the request
    var request = request
      .facet(ejs.TermsFacet('map')
        .field($scope.panel.field)
        .size($scope.panel['size'])
        .exclude($scope.panel.exclude)
        .facetFilter(ejs.QueryFilter(
          ejs.FilteredQuery(
            ejs.QueryStringQuery($scope.panel.query || '*'),
            ejs.RangeFilter($scope.time.field)
              .from($scope.time.from)
              .to($scope.time.to)
            )))).size(0);

    $scope.populate_modal(request);

    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.panel.loading = false;
      $scope.hits = results.hits.total;
      $scope.data = {};
      _.each(results.facets.map.terms, function(v) {
        $scope.data[v.term.toUpperCase()] = v.count;
      });
      $scope.$emit('render')
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

  $scope.build_search = function(field,value) {
    $scope.panel.query = add_to_query($scope.panel.query,field,value,false)
    $scope.get_data();
    eventBus.broadcast($scope.$id,$scope.panel.group,'query',[$scope.panel.query]);
  }

})
.directive('map', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      elem.html('<center><img src="common/img/load_big.gif"></center>')

      // Receive render events
      scope.$on('render',function(){
        render_panel();
      });

      // Or if the window is resized
      angular.element(window).bind('resize', function(){
        render_panel();
      });

      function render_panel() {
        // Using LABjs, wait until all scripts are loaded before rendering panel
        var scripts = $LAB.script("panels/map/lib/jquery.jvectormap.min.js")
          .script("panels/map/lib/map."+scope.panel.map+".js")
                    
        // Populate element. Note that jvectormap appends, does not replace.
        scripts.wait(function(){
          elem.text('');
          $('.jvectormap-zoomin,.jvectormap-zoomout,.jvectormap-label').remove();
          var map = elem.vectorMap({  
            map: scope.panel.map,
            regionStyle: {initial: {fill: '#8c8c8c'}},
            zoomOnScroll: false,
            backgroundColor: null,
            series: {
              regions: [{
                values: scope.data,
                scale: scope.panel.colors,
                normalizeFunction: 'polynomial'
              }]
            },
            onRegionLabelShow: function(event, label, code){
              $('.jvectormap-label').css({
                "position"    : "absolute",
                "display"     : "none",
                'color'       : "#c8c8c8",
                'padding'     : '10px',
                'font-size'   : '11pt',
                'font-weight' : 200,
                'background-color': '#1f1f1f',
                'border-radius': '5px'
              })
              var count = _.isUndefined(scope.data[code]) ? 0 : scope.data[code];
              $('.jvectormap-label').text(label.text() + ": " + count);
            },
            onRegionOut: function(event, code) {
            },
            onRegionClick: function(event, code) {
              var count = _.isUndefined(scope.data[code]) ? 0 : scope.data[code];
              if (count != 0) 
                scope.build_search(scope.panel.field,code)
            }
          });
        })
      }
    }
  };
});