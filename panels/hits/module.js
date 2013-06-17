/*

  ## Hits

  A variety of representations of the hits a query matches

  ### Parameters
  * query ::  An array of queries. No labels here, just an array of strings. Maybe
              there should be labels. Probably. 
  * style :: A hash of css styles
  * arrangement :: How should I arrange the query results? 'horizontal' or 'vertical'
  * chart :: Show a chart? 'none', 'bar', 'pie'
  * donut :: Only applies to 'pie' charts. Punches a hole in the chart for some reason
  * tilt :: Only 'pie' charts. Janky 3D effect. Looks terrible 90% of the time. 
  * lables :: Only 'pie' charts. Labels on the pie?
  ### Group Events
  #### Sends
  * get_time :: On panel initialization get time range to query
  #### Receives
  * time :: An object containing the time range to use and the index(es) to query
  * query :: An Array of queries, even if its only one

*/
angular.module('kibana.hits', [])
.controller('hits', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    status  : "Beta",
    query   : ["*"],
    group   : "default",
    style   : { "font-size": '10pt'},
    arrangement : 'vertical',
    chart       : 'none',
    counter_pos : 'above',
    donut   : false,
    tilt    : false,
    labels  : true
  }
  _.defaults($scope.panel,_d)

  $scope.init = function () {
    $scope.hits = 0;
    eventBus.register($scope,'time', function(event,time){
      set_time(time)
    });
    eventBus.register($scope,'query', function(event, query) {
      $scope.panel.query = _.map(query,function(q) {
        return {query: q, label: q};
      })
      $scope.get_data();
    });
    // Now that we're all setup, request the time from our group
    eventBus.broadcast($scope.$id,$scope.panel.group,'get_time')
  }

  $scope.get_data = function(segment,query_id) {
    delete $scope.panel.error
    $scope.panel.loading = true;

    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.index) || _.isUndefined($scope.time))
      return

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

    // Build the facet part
    _.each(queries, function(v) {
      request = request
        .facet($scope.ejs.QueryFacet("query"+_.indexOf(queries,v))
          .query(v)
        ).size(0)
    })

    // TODO: Spy for hits panel
    //$scope.populate_modal(request);

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
          var hits = _.isUndefined($scope.data[i]) || _segment == 0 ? 
            v.count : $scope.data[i].hits+v.count
          $scope.hits += v.count

          // Create series
          $scope.data[i] = { 
            label: $scope.panel.query[i].label || "query"+(parseInt(i)+1), 
            hits: hits,
            data: [[i,hits]]
          };

          i++;
        });
        $scope.$emit('render');
        if(_segment < $scope.index.length-1) 
          $scope.get_data(_segment+1,query_id)
        
      }
    });
  }

  $scope.remove_query = function(q) {
    $scope.panel.query = _.without($scope.panel.query,q);
    $scope.get_data();
  }

  $scope.add_query = function(label,query) {
    $scope.panel.query.unshift({
      query: query,
      label: label, 
    });
    $scope.get_data();
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

  function set_time(time) {
    $scope.time = time;
    $scope.index = _.isUndefined(time.index) ? $scope.index : time.index
    $scope.get_data();
  }

}).directive('hitsChart', function(eventBus) {
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

        var scripts = $LAB.script("common/lib/panels/jquery.flot.js").wait()
                          .script("common/lib/panels/jquery.flot.pie.js")

        // Populate element.
        scripts.wait(function(){
          // Populate element
          try {
            // Add plot to scope so we can build out own legend 
            if(scope.panel.chart === 'bar')
              scope.plot = $.plot(elem, scope.data, {
                legend: { show: false },
                series: {
                  lines:  { show: false, },
                  bars:   { show: true,  fill: 1, barWidth: 0.8, horizontal: false },
                  shadowSize: 1
                },
                yaxis: { show: true, min: 0, color: "#c8c8c8" },
                xaxis: { show: false },
                grid: {
                  backgroundColor: '#272b30',
                  borderWidth: 0,
                  borderColor: '#eee',
                  color: "#eee",
                  hoverable: true,
                },
                colors: ['#86B22D','#BF6730','#1D7373','#BFB930','#BF3030','#77207D']
              })
            if(scope.panel.chart === 'pie')
              scope.plot = $.plot(elem, scope.data, {
                legend: { show: false },
                series: {
                  pie: {
                    innerRadius: scope.panel.donut ? 0.4 : 0,
                    tilt: scope.panel.tilt ? 0.45 : 1,
                    radius: 1,
                    show: true,
                    combine: {
                      color: '#999',
                      label: 'The Rest'
                    },
                    stroke: {
                      color: '#272b30',
                      width: 0
                    },
                    label: { 
                      show: scope.panel.labels,
                      radius: 2/3,
                      formatter: function(label, series){
                        return '<div ng-click="build_search(panel.query.field,\''+label+'\') "style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                          label+'<br/>'+Math.round(series.percent)+'%</div>';
                      },
                      threshold: 0.1 
                    }
                  }
                },
                //grid: { hoverable: true, clickable: true },
                grid:   { hoverable: true, clickable: true },
                colors: ['#86B22D','#BF6730','#1D7373','#BFB930','#BF3030','#77207D']
              });

            // Compensate for the height of the  legend. Gross
            elem.height(
              (scope.panel.height || scope.row.height).replace('px','') - $("#"+scope.$id+"-legend").height())

            // Work around for missing legend at initialization
            if(!scope.$$phase)
              scope.$apply()

          } catch(e) {
            elem.text(e)
          }
        })
      }

      function tt(x, y, contents) {
        var tooltip = $('#pie-tooltip').length ? 
          $('#pie-tooltip') : $('<div id="pie-tooltip"></div>');
        //var tooltip = $('#pie-tooltip')
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
          var value = scope.panel.chart === 'bar' ? 
            item.datapoint[1] : item.datapoint[1][0][1];
          tt(pos.pageX, pos.pageY,
            "<div style='vertical-align:middle;border-radius:10px;display:inline-block;background:"+
            item.series.color+";height:20px;width:20px'></div> "+value.toFixed(0))
        } else {
          $("#pie-tooltip").remove();
        }
      });

    }
  };
})
