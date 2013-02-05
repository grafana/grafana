angular.module('kibana.histogram', [])
.controller('histogram', function($scope, $rootScope) {

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

  $scope.get_data = function() {
    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.panel.time))
      return

    var request = $scope.ejs.Request().indices($scope.index);
    
    // Build the question part of the query
    var queries = [];
    _.each($scope.panel.query, function(v) {
      queries.push($scope.ejs.FilteredQuery(
        ejs.QueryStringQuery(v.query || '*'),
        ejs.RangeFilter(config.timefield)
          .from($scope.panel.time.from)
          .to($scope.panel.time.to)
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
        var data = [[$scope.panel.time.from.getTime(), null]];
        _.each(v.entries, function(v, k) {
          data.push([v['time'],v['count']])
        });
        data.push([$scope.panel.time.to.getTime(), null])
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

  if (!(_.isUndefined($scope.panel.group))) {
    $scope.$on($scope.panel.group+"-query", function(event, query) {
      $scope.panel.query[0].query = query;
      $scope.get_data();
    });
    $scope.$on($scope.panel.group+"-time", function(event, time) {
      $scope.panel.time = time;
      $scope.panel.interval = secondsToHms(
        calculate_interval(time.from,time.to,50,0)/1000),
      $scope.get_data();
    });
  }

  // Now that we're all setup, request the time from our group
  $rootScope.$broadcast($scope.panel.group+"-get_time")


})
.directive('histogram', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs, ctrl) {

      // If the data or row state changes, re-render
      scope.$watch(function () {
        return angular.toJson([scope.data, scope.row]) 
      }, function() {
        if(!(_.isUndefined(scope.data)))
          render_panel(scope,elem,attrs);
      });

      // Re-render if the window is resized
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