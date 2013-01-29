labjs = labjs.script("common/lib/panels/jquery.flot.js")
  .script("common/lib/panels/jquery.flot.pie.js")

angular.module('kibana.pieterms', [])
.directive('pieterms', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Specify defaults for ALL directives
      var _d = {
        size    : 5,
        query   : "*",
        exclude : [],
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
          .facet(ejs.TermsFacet('termpie')
            .field(params.field)
            .size(params['size'])
            .exclude(params.exclude)
            .facetFilter(ejs.QueryFilter(query))
          )
          .doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          scope.hits = results.hits.total;
          scope.data = results.facets.termpie.terms;
        });
      }

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Parse our params object
        var params = scope.params;

        // Create graph array
        scope.graph = [];
        _.each(scope.data, function(v, k) {
          if(!_.isUndefined(params.only) && _.indexOf(params.only,v['term']) < 0)
            return

          var point = {
            label : v['term'],
            data  : v['count']
          }

          if(!_.isUndefined(params.colors))
            point.color = params.colors[_.indexOf(params.only,v['term'])] 

          scope.graph.push(point)
        });

        var pie = {
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
        };

        // Populate element
        $.plot(elem, scope.graph, pie);
        //elem.show();
      }
    }
  };
})