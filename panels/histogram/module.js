angular.module('kibana.histogram', [])
.controller('histogram', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    query   : [ {query: "*", label:"Query"} ],
    interval: secondsToHms(calculate_interval($scope.from,$scope.to,40,0)/1000),
    show    : ['bars','y-axis','x-axis','legend'],
    fill    : 3,
    timezone: 'browser', // browser, utc or a standard timezone
    group   : "default",
  }
  _.defaults($scope.panel,_d)

  $scope.init = function() {
    eventBus.register($scope,'time', function(event,time){set_time(time)});
    eventBus.register($scope,'query', function(event, query) {
      if(_.isArray(query)) {
        $scope.panel.query = _.map(query,function(q) {
          return {query: q, label: q};
        })
      } else {
        $scope.panel.query[0] = {query: query, label: query}
      }
      $scope.get_data();
    });
    // Now that we're all setup, request the time from our group if we don't 
    // have it yet
    if(_.isUndefined($scope.time))
      eventBus.broadcast($scope.$id,$scope.panel.group,'get_time')
  }

  $scope.remove_query = function(q) {
    $scope.panel.query = _.without($scope.panel.query,q);
    $scope.get_data();
  }

  $scope.add_query = function(label,query) {
    if(!(_.isArray($scope.panel.query)))
      $scope.panel.query = new Array();
    $scope.panel.query.unshift({
      query: query,
      label: label, 
    });
    $scope.get_data();
  }

  $scope.get_data = function(segment) {
    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.panel.index) || _.isUndefined($scope.time))
      return

    _segment = _.isUndefined(segment) ? 0 : segment

    $scope.panel.loading = true;
    var request = $scope.ejs.Request().indices($scope.panel.index[_segment]);
    
    // Build the question part of the query
    var queries = [];
    _.each($scope.panel.query, function(v) {
      queries.push($scope.ejs.FilteredQuery(
        ejs.QueryStringQuery(v.query || '*'),
        ejs.RangeFilter($scope.time.field)
          .from($scope.time.from)
          .to($scope.time.to))
      )
    });

    // Build the facet part
    _.each(queries, function(v) {
      request = request
        .facet($scope.ejs.DateHistogramFacet(_.indexOf(queries,v))
          .field($scope.time.field)
          .interval($scope.panel.interval)
          .facetFilter($scope.ejs.QueryFilter(v))
        ).size(0)
    })

    // Then run it
    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.panel.loading = false;
      $scope.hits = results.hits.total;
      if(_segment == 0)
        $scope.data = [];
      
      _.each(results.facets, function(v, k) {
        // Null values at each end of the time range ensure we see entire range
        if(_.isUndefined($scope.data[k]) || _segment == 0) {
          var data = [[$scope.time.from.getTime(), null],[$scope.time.to.getTime(), null]];
        } else {
          var data = $scope.data[k].data
        }

        var segment_data = [];
        _.each(v.entries, function(v, k) {
          segment_data.push([v['time'],v['count']])
        });

        data.splice.apply(data,[1,0].concat(segment_data))

        var series = { 
          data: {
            label: $scope.panel.query[k].label || k, 
            data: data,
          },

        };

        if (!(_.isUndefined($scope.panel.query[k].color)))
          series.data.color = $scope.panel.query[k].color;
        
        $scope.data[k] = series.data
      });
      $scope.$emit('render')
      if(_segment < $scope.panel.index.length-1) 
        $scope.get_data(_segment+1)
    });
  }

  function set_time(time) {
    $scope.time = time;
    $scope.panel.index = _.isUndefined(time.index) ? $scope.panel.index : time.index
    $scope.panel.interval = secondsToHms(
      calculate_interval(time.from,time.to,50,0)/1000),
    $scope.get_data();
  }

})
.directive('histogram', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs, ctrl) {

      // Receive render events
      scope.$on('render',function(){
        render_panel();
      });
  
      // Re-render if the window is resized
      angular.element(window).bind('resize', function(){
        render_panel();
      });

      // Function for rendering panel
      function render_panel() {
        // Determine format
        var show = _.isUndefined(scope.panel.show) ? {
            bars: true, lines: false, points: false
          } : {
            lines:  _.indexOf(scope.panel.show,'lines')   < 0 ? false : true,
            bars:   _.indexOf(scope.panel.show,'bars')    < 0 ? false : true,
            points: _.indexOf(scope.panel.show,'points')  < 0 ? false : true,
            stack:  _.indexOf(scope.panel.show,'stack')   < 0 ? null  : true,
            legend: _.indexOf(scope.panel.show,'legend')  < 0 ? false : true,
            'x-axis': _.indexOf(scope.panel.show,'x-axis') < 0 ? false : true,
            'y-axis': _.indexOf(scope.panel.show,'y-axis') < 0 ? false : true,
          }

        // Set barwidth based on specified interval
        var barwidth = interval_to_seconds(scope.panel.interval)*1000

        var scripts = $LAB.script("common/lib/panels/jquery.flot.js")
          .script("common/lib/panels/jquery.flot.time.js")
          .script("common/lib/panels/jquery.flot.stack.js")
          .script("common/lib/panels/timezone.js")
                    
        // Populate element. Note that jvectormap appends, does not replace.
        scripts.wait(function(){
          // Populate element
          try { $.plot(elem, scope.data, {
            legend: { 
              show: show.legend,
              position: "nw", 
              labelFormatter: function(label, series) {
                return '<span class="legend">' + label + ' / ' + 
                  scope.panel.interval + '</span>';
              }
            },
            series: {
              stack:  show.stack,
              lines:  { show: show.lines, fill: scope.panel.fill/10 },
              bars:   { show: show.bars,  fill: 1, barWidth: barwidth/1.8 },
              points: { show: show.points },
              shadowSize: 1
            },
            yaxis: { show: show['y-axis'], min: 0, color: "#000" },
            xaxis: {
              timezone: scope.panel.timezone,
              show: show['x-axis'],
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
          } catch(e) {
            console.log(e)
          }
        })

        function tt(x, y, contents) {
          var tooltip = $('#pie-tooltip').length ? 
            $('#pie-tooltip') : $('<div id="pie-tooltip"></div>');
          //var tooltip = $('#pie-tooltip')
          tooltip.text(contents).css({
            position: 'absolute',
            top     : y + 5,
            left    : x + 5,
            color   : "#FFF",
            border  : '1px solid #FFF',
            padding : '2px',
            'font-size': '8pt',
            'background-color': '#000',
          }).appendTo("body");
        }

        elem.bind("plothover", function (event, pos, item) {
          if (item) {
            var percent = parseFloat(item.series.percent).toFixed(1) + "%";
            tt(pos.pageX, pos.pageY,
              item.datapoint[1].toFixed(1) + " @ " + 
              new Date(item.datapoint[0]).format(config.timeformat));
          } else {
            $("#pie-tooltip").remove();
          }
        });
      }
    }
  };
})