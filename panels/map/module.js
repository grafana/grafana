angular.module('kibana.map', [])
.controller('map', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    query   : "*",
    map     : "world",
    colors  : ['#C8EEFF', '#0071A4'],
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
    if(_.isUndefined($scope.panel.index) || _.isUndefined($scope.time))
      return

    $scope.panel.loading = true;
    var request = $scope.ejs.Request().indices($scope.panel.index);

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
          'curl -XGET '+config.elasticsearch+'/'+$scope.panel.index+"/_search?pretty -d'\n"+
          angular.toJson(JSON.parse(request.toString()),true)+
        "'</pre>", 
    } 
  }

  function set_time(time) {
    $scope.time = time;
    $scope.panel.index = _.isUndefined(time.index) ? $scope.panel.index : time.index
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
            regionStyle: {initial: {fill: '#ddd'}},
            zoomOnScroll: false,
            backgroundColor: '#fff',
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
                "border"      : "solid 2px #000",
                "background"  : "#FFF",
                "font-weight" : 200,
                "border-radius": "5px",
                "color"       : "#000",
                "padding"     : "5px"
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