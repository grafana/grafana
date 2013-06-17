/*

  ## Pie

  This panel is probably going away. For now its has 2 modes: 
    * terms: Run a terms facet on the query. You're gonna have a bad (ES crashing) day
    if you run in this mode on a high cardinality field
    * goal: Compare the query to this number and display the percentage that the query
    represents

  ### Parameters
  * query :: An object with 3 possible parameters depends on the mode:
  ** field: Fields to run a terms facet on. Only does anything in terms mode
  ** query: A string of the query to run
  ** goal: How many to shoot for, only does anything in goal mode
  * exclude :: In terms mode, ignore these terms
  * donut :: Drill a big hole in the pie
  * tilt :: A janky 3D representation of the pie. Looks terrible 90% of the time.
  * legend :: Show the legend?
  * labels :: Label the slices of the pie?
  * mode :: 'terms' or 'goal'
  * default_field ::  LOL wat? A dumb fail over field if for some reason the query object 
                      doesn't have a field
  * spyable :: Show the 'eye' icon that displays the last ES query for this panel

  ### Group Events
  #### Sends
  * get_time :: On panel initialization get time range to query
  #### Receives
  * time :: An object containing the time range to use and the index(es) to query
  * query :: An Array of queries, this panel will use the first in the array

*/

angular.module('kibana.pie', [])
.controller('pie', function($scope, eventBus) {

  // Set and populate defaults
  var _d = {
    status  : "Deprecating Soon",
    query   : { field:"_all", query:"*", goal: 1}, 
    size    : 10,
    exclude : [],
    donut   : false,
    tilt    : false,
    legend  : true,
    labels  : true,
    mode    : "terms",
    group   : "default",
    default_field : 'DEFAULT',
    spyable : true,
  }
  _.defaults($scope.panel,_d)

  $scope.init = function() {
    eventBus.register($scope,'time', function(event,time){set_time(time)});
    eventBus.register($scope,'query', function(event, query) {
      $scope.panel.query.query = _.isArray(query) ? query[0] : query;
      $scope.get_data();
    });
    // Now that we're all setup, request the time from our group
    eventBus.broadcast($scope.$id,$scope.panel.group,'get_time')
  }


  $scope.remove_query = function(q) {
    if($scope.panel.mode !== 'query') 
      return false;
    $scope.panel.query = _.without($scope.panel.query,q);
    $scope.get_data();
  }

  $scope.add_query = function(label,query) {
    if($scope.panel.mode !== 'query') 
      return false;
    $scope.panel.query.unshift({
      query: query,
      label: label, 
    });
    $scope.get_data();
  }

  $scope.set_mode = function(mode) {
    switch(mode)
    {
    case 'terms':
      $scope.panel.query = {query:"*",field:"_all"};
      break;
    case 'goal':
      $scope.panel.query = {query:"*",goal:100};
      break;
    }
  }

  $scope.get_data = function() {
    // Make sure we have everything for the request to complete
    if(_.isUndefined($scope.index) || _.isUndefined($scope.time))
      return

    $scope.panel.loading = true;
    var request = $scope.ejs.Request().indices($scope.index);

    // Terms mode
    if ($scope.panel.mode == "terms") {
      request = request
        .facet(ejs.TermsFacet('pie')
          .field($scope.panel.query.field || $scope.panel.default_field)
          .size($scope.panel['size'])
          .exclude($scope.panel.exclude)
          .facetFilter(ejs.QueryFilter(
            ejs.FilteredQuery(
              ejs.QueryStringQuery($scope.panel.query.query || '*'),
              ejs.RangeFilter($scope.time.field)
                .from($scope.time.from)
                .to($scope.time.to)
              )))).size(0)

      $scope.populate_modal(request);

      var results = request.doSearch();

      // Populate scope when we have results
      results.then(function(results) {
        $scope.panel.loading = false;
        $scope.hits = results.hits.total;
        $scope.data = [];
        var k = 0;
        _.each(results.facets.pie.terms, function(v) {
          var slice = { label : v.term, data : v.count }; 
          $scope.data.push();
          if(!(_.isUndefined($scope.panel.colors)) 
            && _.isArray($scope.panel.colors)
            && $scope.panel.colors.length > 0) {
            slice.color = $scope.panel.colors[k%$scope.panel.colors.length];
          } 
          $scope.data.push(slice)
          k = k + 1;
        });
        $scope.$emit('render');
      });
    // Goal mode
    } else {
      request = request
        .query(ejs.QueryStringQuery($scope.panel.query.query || '*'))
        .filter(ejs.RangeFilter($scope.time.field)
          .from($scope.time.from)
          .to($scope.time.to)
          .cache(false))
        .size(0)
      
      $scope.populate_modal(request);
 
      var results = request.doSearch();

      results.then(function(results) {
        $scope.panel.loading = false;
        var complete  = results.hits.total;
        var remaining = $scope.panel.query.goal - complete;
        $scope.data = [
          { label : 'Complete', data : complete, color: '#BF6730' },
          { data : remaining, color: '#e2d0c4'}]
        $scope.$emit('render');
      });
    }
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

  $scope.build_search = function(field,value) {
    $scope.panel.query.query = add_to_query($scope.panel.query.query,field,value,false)
    $scope.get_data();
    eventBus.broadcast($scope.$id,$scope.panel.group,'query',[$scope.panel.query.query]);
  }

  function set_time(time) {
    $scope.time = time;
    $scope.index = _.isUndefined(time.index) ? $scope.index : time.index
    $scope.get_data();
  }
  
})
.directive('pie', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      elem.html('<center><img src="common/img/load_big.gif"></center>')

      // Receive render events
      scope.$on('render',function(){
        render_panel();
      });

      // Or if the window is resized
      angular.element(window).bind('resize', function(){
        render_panel();
      });

      // Function for rendering panel
      function render_panel() {
        var scripts = $LAB.script("common/lib/panels/jquery.flot.js").wait()
                        .script("common/lib/panels/jquery.flot.pie.js")

        if(scope.panel.mode === 'goal')
          var label = { 
            show: scope.panel.labels,
            radius: 0,
            formatter: function(label, series){
              var font = parseInt(scope.row.height.replace('px',''))/8 + String('px')
              if(!(_.isUndefined(label)))
                return '<div style="font-size:'+font+';font-weight:bold;text-align:center;padding:2px;color:#fff;">'+
                Math.round(series.percent)+'%</div>';
              else
                return ''
            },
          }
        else 
          var label = { 
            show: scope.panel.labels,
            radius: 2/3,
            formatter: function(label, series){
              return '<div ng-click="build_search(panel.query.field,\''+label+'\') "style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                label+'<br/>'+Math.round(series.percent)+'%</div>';
            },
            threshold: 0.1 
          }

        var pie = {
          series: {
            pie: {
              innerRadius: scope.panel.donut ? 0.45 : 0,
              tilt: scope.panel.tilt ? 0.45 : 1,
              radius: 1,
              show: true,
              combine: {
                color: '#999',
                label: 'The Rest'
              },
              label: label,
              stroke: {
                width: 0
              }
            }
          },
          //grid: { hoverable: true, clickable: true },
          grid:   { 
            backgroundColor: null,
            hoverable: true, 
            clickable: true 
          },
          legend: { show: false },
          colors: ['#86B22D','#BF6730','#1D7373','#BFB930','#BF3030','#77207D']
        };

        // Populate element
        if(elem.is(":visible")){
          scripts.wait(function(){
            scope.plot = $.plot(elem, scope.data, pie);
          });
        }
      }

      function piett(x, y, contents) {
        var tooltip = $('#pie-tooltip').length ? 
          $('#pie-tooltip') : $('<div id="pie-tooltip"></div>');

        tooltip.html(contents).css({
          position: 'absolute',
          top     : y + 10,
          left    : x + 10,
          color   : "#c8c8c8",
          padding : '10px',
          'font-size': '11pt',
          'font-weight' : 200,
          'background-color': '#1f1f1f',
          'border-radius': '5px',
        }).appendTo("body");
      }

      elem.bind("plotclick", function (event, pos, object) {
        if (!object)
          return;
        if(scope.panel.mode === 'terms')
          scope.build_search(scope.panel.query.field,object.series.label);
      });

      elem.bind("plothover", function (event, pos, item) {
        if (item) {
          var percent = parseFloat(item.series.percent).toFixed(1) + "%";
          piett(pos.pageX, pos.pageY, "<div style='vertical-align:middle;display:inline-block;background:"+item.series.color+";height:15px;width:15px;border-radius:10px;'></div> " + 
            (item.series.label||"")+ " " + percent);
        } else {
          $("#pie-tooltip").remove();
        }
      });

    }
  };
})