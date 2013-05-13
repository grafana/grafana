/*

  ## Histogram

  A bucketted time series representation of the current query or queries. Note that this
  panel uses facetting. I tried to make it safe by using sequential/serial querying but,
  yeah, you should know that it uses facetting. It should be pretty safe.

  ### Parameters
  * query ::  an array of objects as such: {query: 'somequery', label 'legent text'}.
              this is usually populated by a stringquery panel wher the query and label
              parameter are the same
  * auto_int :: Auto calculate data point interval?
  * resolution ::  If auto_int is enables, shoot for this many data points, rounding to
                    sane intervals
  * interval :: Datapoint interval in elasticsearch date math format (eg 1d, 1w, 1y, 5y)
  * fill :: Only applies to line charts. Level of area shading from 0-10
  * linewidth ::  Only applies to line charts. How thick the line should be in pixels
                  While the editor only exposes 0-10, this can be any numeric value. 
                  Set to 0 and you'll get something like a scatter plot
  * timezone :: This isn't totally functional yet. Currently only supports browser and utc.
                browser will adjust the x-axis labels to match the timezone of the user's 
                browser
  * spyable ::  Dislay the 'eye' icon that show the last elasticsearch query
  * zoomlinks :: Show the zoom links?
  * bars :: Show bars in the chart
  * stack :: Stack multiple queries. This generally a crappy way to represent things.
             You probably should just use a line chart without stacking
  * points :: Should circles at the data points on the chart
  * lines :: Line chart? Sweet.
  * legend :: Show the legend?
  * x-axis :: Show x-axis labels and grid lines
  * y-axis :: Show y-axis labels and grid lines
  ### Group Events
  #### Receives
  * time :: An object containing the time range to use and the index(es) to query
  * query :: An Array of queries, even if its only one
  #### Sends
  * get_time :: On panel initialization get time range to query

*/

angular.module('kibana.histogram', [])
.controller('histogram', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    group       : "default",
    query       : [ {query: "*", label:"Query"} ],
    mode        : 'count',
    value_field : null,
    auto_int    : true,
    resolution  : 100, 
    interval    : '5m',
    fill        : 3,
    linewidth   : 3,
    timezone    : 'browser', // browser, utc or a standard timezone
    spyable     : true,
    zoomlinks   : true,
    bars        : true,
    stack       : true,
    points      : false,
    lines       : false,
    legend      : true,
    'x-axis'    : true,
    'y-axis'    : true,
  }
  _.defaults($scope.panel,_d)

  $scope.init = function() {
    eventBus.register($scope,'time', function(event,time){$scope.set_time(time)});
    
    // Consider eliminating the check for array, this should always be an array
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
    if(_.isUndefined($scope.index) || _.isUndefined($scope.time))
      return

    if ($scope.panel.auto_int)
      $scope.panel.interval = secondsToHms(calculate_interval($scope.time.from,$scope.time.to,$scope.panel.resolution,0)/1000);

    $scope.panel.loading = true;
    var _segment = _.isUndefined(segment) ? 0 : segment
    var request = $scope.ejs.Request().indices($scope.index[_segment]);
    
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

    // Build the facet part, injecting the query in as a facet filter
    _.each(queries, function(v) {

      var facet = $scope.ejs.DateHistogramFacet("chart"+_.indexOf(queries,v))

      if($scope.panel.mode === 'count') {
        facet = facet.field($scope.time.field)
      } else {
        if(_.isNull($scope.panel.value_field)) {
          $scope.panel.error = "In " + $scope.panel.mode + " mode a field must be specified";
          return
        }
        facet = facet.keyField($scope.time.field).valueField($scope.panel.value_field)
      }
      facet = facet.interval($scope.panel.interval).facetFilter($scope.ejs.QueryFilter(v))
      request = request.facet(facet).size(0)
    })

    // Populate the inspector panel
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

      // Make sure we're still on the same query
      if($scope.query_id === query_id) {

        var i = 0;
        _.each(results.facets, function(v, k) {

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
            segment_data.push([v['time'],v[$scope.panel.mode]])
            hits += v['count']; // The series level hits counter
            $scope.hits += v['count']; // Entire dataset level hits counter
          });
          data.splice.apply(data,[1,0].concat(segment_data)) // Join histogram data

          // Create the flot series object
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

        // Tell the histogram directive to render.
        $scope.$emit('render')

        // If we still have segments left, get them
        if(_segment < $scope.index.length-1) {
          $scope.get_data(_segment+1,query_id)
        }
      
      }
    });
  }

  // function $scope.zoom
  // factor :: Zoom factor, so 0.5 = cuts timespan in half, 2 doubles timespan
  $scope.zoom = function(factor) {
    eventBus.broadcast($scope.$id,$scope.panel.group,'zoom',factor);
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

  $scope.set_refresh = function (state) { 
    $scope.refresh = state; 
  }

  $scope.close_edit = function() {
    if($scope.refresh)
      $scope.get_data();
    $scope.refresh =  false;
    $scope.$emit('render');
  }

  $scope.set_time = function(time) {
    $scope.time = time;
    // Should I be storing the index on the panel? It causes errors if the index
    // goes away. Hmmm.
    $scope.index = time.index || $scope.index
    // Only calculate interval if auto_int is set, otherwise don't touch it
    
    $scope.get_data();
  }

})
.directive('histogramChart', function(eventBus) {
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
 
        // Set barwidth based on specified interval
        var barwidth = interval_to_seconds(scope.panel.interval)*1000

        var scripts = $LAB.script("common/lib/panels/jquery.flot.js")
          .script("common/lib/panels/jquery.flot.time.js")
          .script("common/lib/panels/jquery.flot.stack.js")
          .script("common/lib/panels/jquery.flot.selection.js")
          .script("common/lib/panels/timezone.js")
                    
        // Populate element. Note that jvectormap appends, does not replace.
        scripts.wait(function(){
          var stack = scope.panel.stack ? true : null;

          // Populate element
          try { 
            scope.plot = $.plot(elem, scope.data, {
              legend: { show: false },
              series: {
                stack:  stack,
                lines:  { 
                  show: scope.panel.lines, 
                  fill: scope.panel.fill/10, 
                  lineWidth: scope.panel.linewidth,
                  steps: false
                },
                bars:   { show: scope.panel.bars,  fill: 1, barWidth: barwidth/1.8 },
                points: { show: scope.panel.points, fill: 1, fillColor: false, radius: 5},
                shadowSize: 1
              },
              yaxis: { show: scope.panel['y-axis'], min: 0, color: "#000" },
              xaxis: {
                timezone: scope.panel.timezone,
                show: scope.panel['x-axis'],
                mode: "time",
                timeformat: time_format(scope.panel.interval),
                label: "Datetime",
                color: "#000",
              },
              selection: {
                mode: "x",
                color: '#ccc'
              },
              grid: {
                backgroundColor: '#fff',
                borderWidth: 0,
                borderColor: '#eee',
                color: "#eee",
                hoverable: true,
              },
              colors: ['#86B22D','#BF6730','#1D7373','#BFB930','#BF3030','#77207D']
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
        // If the tool tip already exists, don't recreate it, just update it
        var tooltip = $('#pie-tooltip').length ? 
          $('#pie-tooltip') : $('<div id="pie-tooltip"></div>');

        tooltip.html(contents).css({
          position: 'absolute',
          top     : y + 5,
          left    : x + 5,
          color   : "#000",
          border  : '1px solid #000',
          padding : '10px',
          'font-size': '11pt',
          'font-weight' : 200,
          'background-color': '#FFF',
          'border-radius': '10px',
        }).appendTo("body");
      }

      elem.bind("plothover", function (event, pos, item) {
        if (item) {
          tt(pos.pageX, pos.pageY,
            "<div style='vertical-align:middle;display:inline-block;background:"+item.series.color+";height:15px;width:15px;border-radius:10px;'></div> "+
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