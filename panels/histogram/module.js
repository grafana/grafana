/*jshint globalstrict:true */
/*global angular:true */

/*

  ## Histogram

  ### Parameters
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
  * interactive :: Allow drag to select time range

*/

'use strict';

angular.module('kibana.histogram', [])
.controller('histogram', function($scope, eventBus, querySrv, dashboard, filterSrv) {

  $scope.panelMeta = {
    status  : "Stable",
    description : "A bucketed time series chart of the current query or queries. Uses the "+
      "Elasticsearch date_histogram facet. If using time stamped indices this panel will query"+
      " them sequentially to attempt to apply the lighest possible load to your Elasticsearch cluster"
  };

  // Set and populate defaults
  var _d = {
    mode        : 'count',
    time_field  : '@timestamp',
    queries     : {
      mode        : 'all',
      ids         : []
    },
    value_field : null,
    auto_int    : true,
    resolution  : 100, 
    interval    : '5m',
    fill        : 0,
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
    percentage  : false,
    interactive : true,
  };

  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.$on('refresh',function(){
      $scope.get_data();
    });

    $scope.get_data();

  };

  $scope.get_data = function(segment,query_id) {
    delete $scope.panel.error;

    // Make sure we have everything for the request to complete
    if(dashboard.indices.length === 0) {
      return;
    }


    var _range = $scope.range = filterSrv.timeRange('min');
    
    if ($scope.panel.auto_int) {
      $scope.panel.interval = kbn.secondsToHms(
        kbn.calculate_interval(_range.from,_range.to,$scope.panel.resolution,0)/1000);
    }

    $scope.panelMeta.loading = true;
    var _segment = _.isUndefined(segment) ? 0 : segment;
    var request = $scope.ejs.Request().indices(dashboard.indices[_segment]);

    $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
    // Build the query
    _.each($scope.panel.queries.ids, function(id) {
      var query = $scope.ejs.FilteredQuery(
        querySrv.getEjsObj(id),
        filterSrv.getBoolFilter(filterSrv.ids)
      );

      var facet = $scope.ejs.DateHistogramFacet(id);
      
      if($scope.panel.mode === 'count') {
        facet = facet.field($scope.panel.time_field);
      } else {
        if(_.isNull($scope.panel.value_field)) {
          $scope.panel.error = "In " + $scope.panel.mode + " mode a field must be specified";
          return;
        }
        facet = facet.keyField($scope.panel.time_field).valueField($scope.panel.value_field);
      }
      facet = facet.interval($scope.panel.interval).facetFilter($scope.ejs.QueryFilter(query));
      request = request.facet(facet).size(0);
    });

    // Populate the inspector panel
    $scope.populate_modal(request);

    // Then run it
    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.panelMeta.loading = false;
      if(_segment === 0) {
        $scope.hits = 0;
        $scope.data = [];
        query_id = $scope.query_id = new Date().getTime();
      }
      
      // Check for error and abort if found
      if(!(_.isUndefined(results.error))) {
        $scope.panel.error = $scope.parse_error(results.error);
        return;
      }

      // Convert facet ids to numbers
      var facetIds = _.map(_.keys(results.facets),function(k){return parseInt(k, 10);});

      // Make sure we're still on the same query/queries
      if($scope.query_id === query_id && 
        _.intersection(facetIds,$scope.panel.queries.ids).length === $scope.panel.queries.ids.length
        ) {

        var i = 0;
        var data, hits;

        _.each($scope.panel.queries.ids, function(id) {
          var v = results.facets[id];

          // Null values at each end of the time range ensure we see entire range
          if(_.isUndefined($scope.data[i]) || _segment === 0) {
            data = [];
            if(filterSrv.idsByType('time').length > 0) {
              data = [[_range.from.getTime(), null],[_range.to.getTime(), null]];
            }
            hits = 0;
          } else {
            data = $scope.data[i].data;
            hits = $scope.data[i].hits;
          }

          // Assemble segments
          var segment_data = [];
          _.each(v.entries, function(v, k) {
            segment_data.push([v.time,v[$scope.panel.mode]]);
            hits += v.count; // The series level hits counter
            $scope.hits += v.count; // Entire dataset level hits counter
          });
          data.splice.apply(data,[1,0].concat(segment_data)); // Join histogram data

          // Create the flot series object
          var series = { 
            data: {
              info: querySrv.list[id],
              data: data,
              hits: hits
            },
          };

          $scope.data[i] = series.data;

          i++;
        });

        // Tell the histogram directive to render.
        $scope.$emit('render');

        // If we still have segments left, get them
        if(_segment < dashboard.indices.length-1) {
          $scope.get_data(_segment+1,query_id);
        }
      
      }
    });
  };

  // function $scope.zoom
  // factor :: Zoom factor, so 0.5 = cuts timespan in half, 2 doubles timespan
  $scope.zoom = function(factor) {
    var _now = Date.now();
    var _range = filterSrv.timeRange('min');
    var _timespan = (_range.to.valueOf() - _range.from.valueOf());
    var _center = _range.to.valueOf() - _timespan/2;

    var _to = (_center + (_timespan*factor)/2);
    var _from = (_center - (_timespan*factor)/2);

    // If we're not already looking into the future, don't.
    if(_to > Date.now() && _range.to < Date.now()) {
      var _offset = _to - Date.now();
      _from = _from - _offset;
      _to = Date.now();
    }

    if(factor > 1) {
      filterSrv.removeByType('time');
    }
    filterSrv.set({
      type:'time',
      from:moment.utc(_from),
      to:moment.utc(_to),
      field:$scope.panel.time_field
    });
    
    dashboard.refresh();

  };

  // I really don't like this function, too much dom manip. Break out into directive?
  $scope.populate_modal = function(request) {
    $scope.modal = {
      title: "Inspector",
      body : "<h5>Last Elasticsearch Query</h5><pre>"+
          'curl -XGET '+config.elasticsearch+'/'+dashboard.indices+"/_search?pretty -d'\n"+
          angular.toJson(JSON.parse(request.toString()),true)+
        "'</pre>", 
    }; 
  };

  $scope.set_refresh = function (state) { 
    $scope.refresh = state; 
  };

  $scope.close_edit = function() {
    if($scope.refresh) {
      $scope.get_data();
    }
    $scope.refresh =  false;
    $scope.$emit('render');
  };

})
.directive('histogramChart', function(dashboard, eventBus, filterSrv, $rootScope) {
  return {
    restrict: 'A',
    template: '<div></div>',
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

        // IE doesn't work without this
        elem.css({height:scope.panel.height||scope.row.height});
        
        // Populate from the query service
        try {
          _.each(scope.data,function(series) {
            series.label = series.info.alias;
            series.color = series.info.color;
          });
        } catch(e) {return;}

        // Set barwidth based on specified interval
        var barwidth = kbn.interval_to_seconds(scope.panel.interval)*1000;

        var scripts = $LAB.script("common/lib/panels/jquery.flot.js").wait()
          .script("common/lib/panels/jquery.flot.time.js")
          .script("common/lib/panels/jquery.flot.stack.js")
          .script("common/lib/panels/jquery.flot.selection.js")
          .script("common/lib/panels/timezone.js");
                    
        // Populate element. Note that jvectormap appends, does not replace.
        scripts.wait(function(){
          var stack = scope.panel.stack ? true : null;

          // Populate element
          try { 
            var options = {
              legend: { show: false },
              series: {
                stackpercent: scope.panel.stack ? scope.panel.percentage : false,
                stack: scope.panel.percentage ? null : stack,
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
              yaxis: { 
                show: scope.panel['y-axis'], 
                min: 0, 
                max: scope.panel.percentage && scope.panel.stack ? 100 : null, 
                color: "#c8c8c8" 
              },
              xaxis: {
                timezone: scope.panel.timezone,
                show: scope.panel['x-axis'],
                mode: "time",
                timeformat: time_format(scope.panel.interval),
                label: "Datetime",
                color: "#c8c8c8",
              },
              grid: {
                backgroundColor: null,
                borderWidth: 0,
                borderColor: '#eee',
                color: "#eee",
                hoverable: true,
              }
            };

            if(scope.panel.interactive) {
              options.selection = { mode: "x", color: '#666' };
            }

            scope.plot = $.plot(elem, scope.data, options);

          } catch(e) {
            elem.text(e);
          }
        });
      }

      function time_format(interval) {
        var _int = kbn.interval_to_seconds(interval);
        if(_int >= 2628000) {
          return "%m/%y";
        }
        if(_int >= 86400) {
          return "%m/%d/%y";
        }
        if(_int >= 60) {
          return "%H:%M<br>%m/%d";
        }
        
        return "%H:%M:%S";
      }

      function tt(x, y, contents) {
        // If the tool tip already exists, don't recreate it, just update it
        var tooltip = $('#pie-tooltip').length ? 
          $('#pie-tooltip') : $('<div id="pie-tooltip"></div>');

        tooltip.html(contents).css({
          position: 'absolute',
          top     : y + 5,
          left    : x + 5,
          color   : "#c8c8c8",
          padding : '10px',
          'font-size': '11pt',
          'font-weight' : 200,
          'background-color': '#1f1f1f',
          'border-radius': '5px',
        }).appendTo("body");
      }

      elem.bind("plothover", function (event, pos, item) {
        if (item) {
          tt(pos.pageX, pos.pageY,
            "<div style='vertical-align:middle;display:inline-block;background:"+
            item.series.color+";height:15px;width:15px;border-radius:10px;'></div> "+
            item.datapoint[1].toFixed(0) + " @ " + 
            moment(item.datapoint[0]).format('MM/DD HH:mm:ss'));
        } else {
          $("#pie-tooltip").remove();
        }
      });

      elem.bind("plotselected", function (event, ranges) {
        var _id = filterSrv.set({
          type  : 'time',
          from  : moment.utc(ranges.xaxis.from),
          to    : moment.utc(ranges.xaxis.to),
          field : scope.panel.time_field
        });
        dashboard.refresh();
      });
    }
  };
});