labjs = labjs.script("common/lib/jquery.flot.js")
  .script("common/lib/jquery.flot.pie.js")

angular.module('kibana.piequery', [])
.directive('piequery', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Specify defaults for ALL directives
      var _d = {
        queries : ["*"],
        donut   : false, 
        tilt    : false,
        legend  : true,
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

      // Re-rending the panel if it is resized,
      scope.$watch('data', function() {
        if(scope.ready)
          render_panel(scope,elem,attrs);
      });

      // Or if the model changes
      angular.element(window).bind('resize', function(){
          render_panel(scope,elem,attrs);
      });

      // Function for getting data
      function get_data(scope,elem,attrs) {
        var params = scope.params;
        var ejs = scope.ejs;
        var request = ejs.Request().indices(scope.index);
        

        var queries = [];
        // Build the question part of the query
        _.each(params.queries, function(v) {
          queries.push(ejs.FilteredQuery(
            ejs.QueryStringQuery(v || '*'),
            ejs.RangeFilter(config.timefield)
              .from(scope.from)
              .to(scope.to)
              .cache(false))
          )
        });

        _.each(queries, function(v) {
          request = request.facet(ejs.QueryFacet(_.indexOf(queries,v))
            .query(v)
            .facetFilter(ejs.QueryFilter(v))
          )
        })
        // Then the insert into facet and make the request
        var results = request.doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          scope.hits = results.hits.total;
          scope.data = results.facets;
        });
      }

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Parse our params object
        var params = scope.params;

        // Create graph array
        scope.graph = [];
        _.each(scope.data, function(v, k) {
          var point = {
            label : params.queries[k],
            data  : v['count']
          }
          if(!_.isUndefined(params.colors))
            point.color = params.colors[k%params.colors.length];
          scope.graph.push(point)
        });

        // Populate element
        $.plot(elem, scope.graph, {
            series: {
              pie: {
                innerRadius: params.donut ? 0.4 : 0,
                tilt: params.tilt ? 0.45 : 1,
                radius: 1,
                show: true,
                combine: {
                  color: '#999',
                  label: 'The Rest'
                },
                label: { 
                  show: true,
                  radius: 2/3,
                  formatter: function(label, series){
                    return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                      label+'<br/>'+Math.round(series.percent)+'%</div>';
                  },
                  threshold: 0.1 
                }
              }
            },
            //grid: { hoverable: true, clickable: true },
            legend: { show: params.legend }
          });
        //elem.show();
      }
    }
  };
})