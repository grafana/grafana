labjs = labjs.script("common/lib/panels/jquery.jvectormap.min.js");

angular.module('kibana.map', [])
.directive('map', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Specify defaults for ALL directives
      var _d = {
        queries : ["*"],
        map     : "world",
        interval: secondsToHms(calculate_interval(scope.from,scope.to,40,0)/1000),
        colors  : ["#BF3030","#1D7373","#86B32D","#A98A21","#411F73"],
        show    : ['bars'],
        size    : 100,
        exclude : []
      }

      // Set ready flag and fill parameters (REQUIRED IN EVERY PANEL)
      scope.$watch(function () {
        return (attrs.params && scope.index) ? true : false;
      }, function (ready) {
        scope.ready = ready;
        if(ready) {
          scope.params = JSON.parse(attrs.params);
          _.each(_d, function(v, k) {
            scope.params[k] = _.isUndefined(scope.params[k]) 
              ? _d[k] : scope.params[k];
          });
        }
      });

      // Also get the data if time frame changes.
      // (REQUIRED IN EVERY PANEL)
      scope.$watch(function() { 
        return angular.toJson([scope.from, scope.to, scope.ready]) 
      }, function(){
        if(scope.ready)
          get_data(scope,elem,attrs);
      });

      // Re-rending panel if data changes
      scope.$watch('data', function() {
        if(scope.ready)
          render_panel(scope,elem,attrs);
      });

      // Or if the window is resized
      angular.element(window).bind('resize', function(){
          render_panel(scope,elem,attrs);
      });

      // Function for getting data
      function get_data(scope,elem,attrs) {
        var params = scope.params;
        var ejs = scope.ejs;
        var request = ejs.Request().indices(scope.index);
        
        // Build the question part of the query
        var query = ejs.FilteredQuery(
          ejs.QueryStringQuery(params.query || '*'),
          ejs.RangeFilter(config.timefield)
            .from(scope.from)
            .to(scope.to)
            .cache(false)
          );

        // Then the insert into facet and make the request
        var results = request
          .facet(ejs.TermsFacet('map')
            .field(params.field)
            .size(params['size'])
            .exclude(params.exclude)
            .facetFilter(ejs.QueryFilter(query))
          )
          .doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          scope.hits = results.hits.total;
          scope.data = {};
          _.each(results.facets.map.terms, function(v) {
            scope.data[v.term.toUpperCase()] = v.count;
          });
        });
      }

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Parse our params object
        var params = scope.params;

        elem.text('');
        $('.jvectormap-label,.jvectormap-zoomin,.jvectormap-zoomout').remove();

        elem.append("<div class='jvectormap-label'>Loading Map</div>");

        loadmap = $LAB.script("common/lib/panels/map."+params.map+".js")

        // Populate element. Note that jvectormap appends, does not replace.
        loadmap.wait(function(){
          elem.vectorMap({  
            map: params.map,
            regionStyle: {initial: {fill: '#ddd'}},
            zoomOnScroll: false,
            backgroundColor: '#fff',
            series: {
              regions: [{
                values: scope.data,
                scale: ['#C8EEFF', '#0071A4'],
                normalizeFunction: 'polynomial'
              }]
            }
          });
        })
        //elem.show();
      }
    }
  };
});