angular.module('kibana.histogram', [])
.controller('histogram', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    query     : [ {query: "*", label:"Query"} ],
    interval  : secondsToHms(calculate_interval($scope.from,$scope.to,40,0)/1000),
    show      : ['bars','y-axis','x-axis','legend'],
    fill      : 3,
    linewidth : 3,
    timezone  : 'browser', // browser, utc or a standard timezone
    spyable   : true,
    zoomlinks : true,
    group     : "default",
  }
  _.defaults($scope.panel,_d)

  $scope.init = function() {
    eventBus.register($scope,'time', function(event,time){$scope.set_time(time)});
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

  $scope.get_data = function(segment,query_id) {
    delete $scope.panel.error
    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.panel.index) || _.isUndefined($scope.time))
      return

    var _segment = _.isUndefined(segment) ? 0 : segment

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
        .facet($scope.ejs.DateHistogramFacet("chart"+_.indexOf(queries,v))
          .field($scope.time.field)
          .interval($scope.panel.interval)
          .facetFilter($scope.ejs.QueryFilter(v))
        ).size(0)
    })

    $scope.populate_modal(request);

    // Then run it
    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.panel.loading = false;
      if(_segment == 0) {
        $scope.hits = 0;
        $scope.data = [];
        query_id = $scope.query_id = new Date().getTime();
      }
      
      // Check for error and abort if found
      if(!(_.isUndefined(results.error))) {
        $scope.panel.error = $scope.parse_error(results.error);
        return;
      }


      if($scope.query_id === query_id) {

        var i = 0;
        _.each(results.facets, function(v, k) {
          // If this isn't a date histogram it must be a QueryFacet, get the
          // count and return
          if(v._type !== 'date_histogram') {
            //$scope.hits += v.count;
            return
          }

          // Null values at each end of the time range ensure we see entire range
          if(_.isUndefined($scope.data[i]) || _segment == 0) {
            var data = [[$scope.time.from.getTime(), null],[$scope.time.to.getTime(), null]];
            var hits = 0;
          } else {
            var data = $scope.data[i].data
            var hits = $scope.data[i].hits
          }

          // Assemble segments
          var segment_data = [];
          _.each(v.entries, function(v, k) {
            segment_data.push([v['time'],v['count']])
            hits += v['count'];
            $scope.hits += v['count'];
          });

          data.splice.apply(data,[1,0].concat(segment_data))


          // Create the flot series
          var series = { 
            data: {
              label: $scope.panel.query[i].label || "query"+(parseInt(i)+1), 
              data: data,
              hits: hits
            },
          };

          if (!(_.isUndefined($scope.panel.query[i].color)))
            series.data.color = $scope.panel.query[i].color;
          
          $scope.data[i] = series.data

          i++;
        });

        $scope.$emit('render')
        if(_segment < $scope.panel.index.length-1) {
          $scope.get_data(_segment+1,query_id)
        }
      
      }
    });
  }

  // function $scope.zoom
  // factor :: Zoom factor, so 0.5 = cuts timespan in half, 2 doubles timespan
  $scope.zoom = function(factor) {
    eventBus.broadcast($scope.$id,$scope.panel.group,'zoom',factor)
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

  $scope.set_time = function(time) {
    $scope.time = time;
    $scope.panel.index = _.isUndefined(time.index) ? $scope.panel.index : time.index
    $scope.panel.interval = secondsToHms(
      calculate_interval(time.from,time.to,50,0)/1000);
    $scope.get_data();
  }

})
.directive('histogram', function(eventBus) {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs, ctrl) {

      var height = scope.panel.height || scope.row.height;

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
          .script("common/lib/panels/jquery.flot.selection.js")
          .script("common/lib/panels/timezone.js")
                    
        // Populate element. Note that jvectormap appends, does not replace.
        scripts.wait(function(){

          // Populate element
          try { 
            var plot = $.plot(elem, scope.data, {
              legend: { 
                show: false,
              },
              series: {
                stack:  show.stack,
                lines:  { 
                  show: show.lines, 
                  fill: scope.panel.fill/10, 
                  lineWidth: scope.panel.linewidth,
                  steps: true
                },
                bars:   { show: show.bars,  fill: 1, barWidth: barwidth/1.8 },
                points: { show: show.points, fill: 1, fillColor: false},
                shadowSize: 1
              },
              yaxis: { show: show['y-axis'], min: 0, color: "#000" },
              xaxis: {
                timezone: scope.panel.timezone,
                show: show['x-axis'],
                mode: "time",
                timeformat: time_format(scope.panel.interval),
                label: "Datetime",
                color: "#000",
              },
              selection: {
                mode: "x"
              },
              grid: {
                backgroundColor: '#fff',
                borderWidth: 0,
                borderColor: '#eee',
                color: "#eee",
                hoverable: true,
              },
              colors: ['#EB6841','#00A0B0','#6A4A3C','#EDC951','#CC333F']
            })

            scope.legend = [];
            _.each(plot.getData(),function(series) {
              scope.legend.push(_.pick(series,'label','color','hits'))
            })
            
            // Work around for missing legend at initialization
            if(!scope.$$phase)
              scope.$apply()

          } catch(e) {
            elem.text(e)
          }
        })
      }

      function time_format(interval) {
        var _int = interval_to_seconds(interval)
        if(_int >= 2628000)
          return "%m/%y"
        if(_int >= 86400)
          return "%m/%d/%y"
        if(_int >= 60)
          return "%H:%M<br>%m/%d"
        else
          return "%H:%M:%S"
      }

      function tt(x, y, contents) {
        var tooltip = $('#pie-tooltip').length ? 
          $('#pie-tooltip') : $('<div id="pie-tooltip"></div>');
        //var tooltip = $('#pie-tooltip')
        tooltip.html(contents).css({
          position: 'absolute',
          top     : y + 5,
          left    : x + 5,
          color   : "#000",
          border  : '3px solid #000',
          padding : '10px',
          'font-size': '11pt',
          'font-weight' : 'bold',
          'background-color': '#FFF',
          'border-radius': '10px',
        }).appendTo("body");
      }

      elem.bind("plothover", function (event, pos, item) {
        if (item) {
          tt(pos.pageX, pos.pageY,
            "<div style='vertical-align:middle;display:inline-block;background:"+item.series.color+";height:20px;width:20px'></div> "+
            item.datapoint[1].toFixed(0) + " @ " + 
            new Date(item.datapoint[0]).format('mm/dd HH:MM:ss'));
        } else {
          $("#pie-tooltip").remove();
        }
      });

      elem.bind("plotselected", function (event, ranges) {
        scope.time.from = new Date(ranges.xaxis.from);
        scope.time.to   = new Date(ranges.xaxis.to)
        eventBus.broadcast(scope.$id,scope.panel.group,'set_time',scope.time)
      });
    }
  };
})