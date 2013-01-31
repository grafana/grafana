angular.module('kibana.histogram', [])
.controller('histogram', function($scope, $location) {

  // Set and populate defaults
  var _d = {
    query   : "*",
    interval: secondsToHms(calculate_interval($scope.from,$scope.to,40,0)/1000),
    color   : "#27508C",
    show    : ['bars'],
    fill    : false,
  }
  _.each(_d, function(v, k) {
    $scope.panel[k] = _.isUndefined($scope.panel[k]) 
      ? _d[k] : $scope.panel[k];
  });

  if (!(_.isUndefined($scope.panel.group))) {
    $scope.$on($scope.panel.group+"-query", function(event, query) {
      $scope.panel.query[0].query = query;
      $scope.get_data();
    });
  }

  $scope.get_data = function() {
    var request = $scope.ejs.Request().indices($scope.index);
    
    // Build the question part of the query
    var queries = [];
    _.each($scope.panel.query, function(v) {
      queries.push($scope.ejs.FilteredQuery(
        ejs.QueryStringQuery(v.query || '*'),
        ejs.RangeFilter(config.timefield)
          .from($scope.from)
          .to($scope.to)
          .cache(false))
      )
    });

    // Build the facet part
    _.each(queries, function(v) {
      request = request
        .facet($scope.ejs.DateHistogramFacet(_.indexOf(queries,v))
          .field(config.timefield)
          .interval($scope.panel.interval)
          .facetFilter($scope.ejs.QueryFilter(v))
        ).size(0)
    })

    // Then run it
    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.hits = results.hits.total;
      // Null values at each end of the time range make sure we see entire range

      $scope.data = [];
      _.each(results.facets, function(v, k) {
        var series = {};
        var data = [[$scope.from.getTime(), null]];
        _.each(v.entries, function(v, k) {
          data.push([v['time'],v['count']])
        });
        data.push([$scope.to.getTime(), null])
        series.data = {
          label: $scope.panel.query[k].label, 
          data: data, 
        };
        if (!(_.isUndefined($scope.panel.query[k].color)))
          series.data.color = $scope.panel.query[k].color;
        $scope.data.push(series.data)
      });
    });
  }

  $scope.$watch(function() { 
    return angular.toJson([$scope.from, $scope.to]) 
  }, function(){
    $scope.panel.interval = secondsToHms(
      calculate_interval($scope.from,$scope.to,50,0)/1000),
    $scope.get_data();
  });

})
.directive('histogram', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs, ctrl) {

      scope.$watch('data', function() {
        if(!(_.isUndefined(scope.data)))
          render_panel(scope,elem,attrs);
      });

      // Re-render if the window is
      angular.element(window).bind('resize', function(){
          render_panel(scope,elem,attrs);
      });

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Determine format
        var show = _.isUndefined(scope.panel.show) ? {
            bars: true, lines: false, points: false
          } : {
            lines:  _.indexOf(scope.panel.show,'lines')   < 0 ? false : true,
            bars:   _.indexOf(scope.panel.show,'bars')    < 0 ? false : true,
            points: _.indexOf(scope.panel.show,'points')  < 0 ? false : true,
            stack:  _.indexOf(scope.panel.show,'stack')   < 0 ? null  : true,
          }

        // Set barwidth based on specified interval
        var barwidth = interval_to_seconds(scope.panel.interval)*1000

        var scripts = $LAB.script("common/lib/panels/jquery.flot.js")
          .script("common/lib/panels/jquery.flot.time.js")
          .script("common/lib/panels/jquery.flot.stack.js")
                    
        // Populate element. Note that jvectormap appends, does not replace.
        scripts.wait(function(){
        // Populate element
          $.plot(elem, scope.data, {
            legend: { 
              position: "nw", 
              labelFormatter: function(label, series) {
                return '<span class="legend">' + label + ' / ' + 
                  scope.panel.interval + '</span>';
              }
            },
            series: {
              stack:  show.stack,
              lines:  { show: show.lines, fill: scope.panel.fill },
              bars:   { show: show.bars,  fill: 1, barWidth: barwidth/1.8 },
              points: { show: show.points },
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
          })
        })
      }
    }
  };
})