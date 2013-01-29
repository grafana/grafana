labjs = labjs.script("common/lib/jquery.flot.js")
  .script("common/lib/jquery.flot.time.js")

angular.module('kibana.histogram', [])
.directive('histogram', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Specify defaults for ALL directives
      var _d = {
        query   : "*",
        interval: secondsToHms(calculate_interval(scope.from,scope.to,40,0)/1000),
        color   : "#27508C",
        show    : ['bars']
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
          if (_.isUndefined(attrs.params.interval))
            scope.params.interval = secondsToHms(
              calculate_interval(scope.from,scope.to,50,0)/1000),
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
          .facet(ejs.DateHistogramFacet('histogram')
            .field(config.timefield)
            .interval(params.interval)
            .facetFilter(ejs.QueryFilter(query))
          )
          .doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          scope.hits = results.hits.total;
          scope.data = results.facets.histogram.entries;
        });
      }

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Parse our params object
        var params = scope.params;

        // Determine format
        var show = _.isUndefined(params.show) ? {
            bars: true, lines: false, points: false
          } : {
            lines:  _.indexOf(params.show,'lines') < 0 ? false : true,
            bars:   _.indexOf(params.show,'bars') < 0 ? false : true,
            points: _.indexOf(params.show,'points') < 0 ? false : true,
          }

        // Push null values at beginning and end of timeframe
        scope.graph = [
          [scope.from.getTime(), null],[scope.to.getTime(), null]];

        // Create FLOT value array 
        _.each(scope.data, function(v, k) {
          scope.graph.push([v['time'],v['count']])
        });

        // Set barwidth based on specified interval
        var barwidth = interval_to_seconds(params.interval)*1000

        // Populate element
        $.plot(elem, [{
          label: _.isUndefined(params.label) ? params.query: params.label, 
          data: scope.graph
        }], {
          legend: { 
            position: "nw", 
            labelFormatter: function(label, series) {
              return '<span class="legend">' + label + ' / ' + params.interval 
                + '</span>';
            }
          },
          series: {
            lines:  { show: show.lines, fill: false },
            bars:   { show: show.bars,  fill: 1, barWidth: barwidth/1.8 },
            points: { show: show.points },
            color: params.color,
            shadowSize: 1
          },
          yaxis: { min: 0, color: "#000" },
          xaxis: {
            mode: "time",
            timeformat: "%H:%M:%S<br>%m-%d",
            label: "Datetime",
            color: "#000",
          },
          grid: {
            backgroundColor: '#fff',
            borderWidth: 0,
            borderColor: '#eee',
            color: "#eee",
            hoverable: true,
          }
        });
        //elem.show();
      }
    }
  };
})