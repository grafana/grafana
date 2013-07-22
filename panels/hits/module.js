/*jshint globalstrict:true */
/*global angular:true */

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

*/

'use strict';

angular.module('kibana.hits', [])
.controller('hits', function($scope, query, dashboard, filterSrv) {

  // Set and populate defaults
  var _d = {
    status  : "Beta",
    query   : ["*"],
    group   : "default",
    style   : { "font-size": '10pt'},
    arrangement : 'horizontal',
    chart       : 'bar',
    counter_pos : 'above',
    donut   : false,
    tilt    : false,
    labels  : true
  };
  _.defaults($scope.panel,_d);

  $scope.init = function () {
    $scope.hits = 0;
   
    $scope.$on('refresh',function(){
      $scope.get_data();
    });
    $scope.get_data();

  };

  $scope.get_data = function(segment,query_id) {
    delete $scope.panel.error;
    $scope.panel.loading = true;

    // Make sure we have everything for the request to complete
    if(dashboard.indices.length === 0) {
      return;
    }

    var _segment = _.isUndefined(segment) ? 0 : segment;
    var request = $scope.ejs.Request().indices(dashboard.indices[_segment]);
    
    // Build the question part of the query
    _.each(query.ids, function(id) {
      var _q = $scope.ejs.FilteredQuery(
        $scope.ejs.QueryStringQuery(query.list[id].query || '*'),
        filterSrv.getBoolFilter(filterSrv.ids));
    
      request = request
        .facet($scope.ejs.QueryFacet(id)
          .query(_q)
        ).size(0);
    });

    // TODO: Spy for hits panel
    //$scope.populate_modal(request);

    // Then run it
    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.panel.loading = false;
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
        _.intersection(facetIds,query.ids).length === query.ids.length
        ) {
        var i = 0;
        _.each(query.ids, function(id) {
          var v = results.facets[id];
          var hits = _.isUndefined($scope.data[i]) || _segment === 0 ? 
            v.count : $scope.data[i].hits+v.count;
          $scope.hits += v.count;

          // Create series
          $scope.data[i] = { 
            info: query.list[id],
            id: id,
            hits: hits,
            data: [[i,hits]]
          };

          i++;
        });
        $scope.$emit('render');
        if(_segment < dashboard.indices.length-1) {
          $scope.get_data(_segment+1,query_id);
        }
        
      }
    });
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

  function set_time(time) {
    $scope.time = time;
    $scope.get_data();
  }

}).directive('hitsChart', function(query) {
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
        // IE doesn't work without this
        elem.css({height:scope.panel.height||scope.row.height});

        try {
          _.each(scope.data,function(series) {
            series.label = series.info.alias;
            series.color = series.info.color;
          });
        } catch(e) {return;}

        var scripts = $LAB.script("common/lib/panels/jquery.flot.js").wait()
                          .script("common/lib/panels/jquery.flot.pie.js");

        // Populate element.
        scripts.wait(function(){
          // Populate element
          try {
            // Add plot to scope so we can build out own legend 
            if(scope.panel.chart === 'bar') {
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
                  borderWidth: 0,
                  borderColor: '#eee',
                  color: "#eee",
                  hoverable: true,
                },
                colors: query.colors
              });
            }
            if(scope.panel.chart === 'pie') {
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
                colors: query.colors
              });
            }

            // Work around for missing legend at initialization
            if(!scope.$$phase) {
              scope.$apply();
            }

          } catch(e) {
            elem.text(e);
          }
        });
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
            item.series.color+";height:20px;width:20px'></div> "+value.toFixed(0));
        } else {
          $("#pie-tooltip").remove();
        }
      });

    }
  };
});
