angular.module('kibana.hits', [])
.controller('hits', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    query   : "*",
    group   : "default",
    style   : { "font-size": '10pt'},
    aggregate   : true,
    arrangement : 'vertical',
    chart   : true,
    counters: true,
    count_pos: 'above'
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
    if(_.isUndefined($scope.panel.index) || _.isUndefined($scope.time))
      return

    var _segment = _.isUndefined(segment) ? 0 : segment
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
        if(_segment < $scope.panel.index.length-1) 
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

  function set_time(time) {
    $scope.time = time;
    $scope.panel.index = _.isUndefined(time.index) ? $scope.panel.index : time.index
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

        var scripts = $LAB.script("common/lib/panels/jquery.flot.js")
                    
        // Populate element. Note that jvectormap appends, does not replace.
        scripts.wait(function(){
          // Populate element
          try {
            // Add plot to scope so we can build out own legend 
            scope.plot = $.plot(elem, scope.data, {
              legend: { show: false },
              series: {
                lines:  { show: false, },
                bars:   { show: true,  fill: 1, barWidth: 0.8, horizontal: false },
                shadowSize: 1
              },
              yaxis: { show: true, min: 0, color: "#000" },
              xaxis: { show: false },
              grid: {
                backgroundColor: '#fff',
                borderWidth: 0,
                borderColor: '#eee',
                color: "#eee",
                hoverable: true,
              },
              colors: ['#EB6841','#00A0B0','#6A4A3C','#EDC951','#CC333F']
            })
            
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
          color   : "#000",
          border  : '2px solid #000',
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
            "<div style='vertical-align:middle;border-radius:10px;display:inline-block;background:"+item.series.color+";height:20px;width:20px'></div> "+
            item.datapoint[1].toFixed(0))
        } else {
          $("#pie-tooltip").remove();
        }
      });

    }
  };
})
