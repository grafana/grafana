angular.module('kibana.parallelcoordinates', [])
  .controller('parallelcoordinates', function ($scope, eventBus) {


    $scope.activeDocs = [];

    // Set and populate defaults
    var _d = {
      status  : "Broken",
      query   : "*",
      size    : 100, // Per page
      pages   : 5,   // Pages available
      offset  : 0,
      sort    : ['@timestamp','desc'],
      group   : "default",
      style   : {'font-size': '9pt'},
      fields  : [],
      sortable: true,
      spyable: true
    }

    _.defaults($scope.panel, _d)

    $scope.init = function () {

      $scope.set_listeners($scope.panel.group);
      // Now that we're all setup, request the time from our group
      eventBus.broadcast($scope.$id,$scope.panel.group,"get_time")

      //and get the currently selected fields
      eventBus.broadcast($scope.$id,$scope.panel.group,"get_fields")
    };

    $scope.set_listeners = function(group) {
      eventBus.register($scope,'time',function(event,time) {
        $scope.panel.offset = 0;
        set_time(time)
      });
      eventBus.register($scope,'query',function(event,query) {
        $scope.panel.offset = 0;
        $scope.panel.query = _.isArray(query) ? query[0] : query;
        $scope.get_data();
      });
      eventBus.register($scope,'sort', function(event,sort){
        $scope.panel.sort = _.clone(sort);
        $scope.get_data();
      });
      eventBus.register($scope,'selected_fields', function(event, fields) {
        $scope.panel.fields = _.clone(fields)
        $scope.$emit('render');
      });
    };


    $scope.get_data = function (segment,query_id) {

      // Make sure we have everything for the request to complete
      if (_.isUndefined($scope.index) || _.isUndefined($scope.time))
        return;

      var _segment = _.isUndefined(segment) ? 0 : segment
      $scope.segment = _segment;

      $scope.panel.loading = true;
      var request = $scope.ejs.Request().indices($scope.index[_segment])
        .query(ejs.FilteredQuery(
          ejs.QueryStringQuery($scope.panel.query || '*'),
          ejs.RangeFilter($scope.time.field)
            .from($scope.time.from)
            .to($scope.time.to)
        )
        )
        .size($scope.panel.size*$scope.panel.pages)
        .sort($scope.panel.sort[0],$scope.panel.sort[1]);

      $scope.populate_modal(request);

      var results = request.doSearch();


      // Populate scope when we have results
      results.then(function (results) {
        $scope.panel.loading = false;
        if(_segment === 0) {
          $scope.hits = 0;
          $scope.data = [];
          query_id = $scope.query_id = new Date().getTime()
        }

        // Check for error and abort if found
        if(!(_.isUndefined(results.error))) {
          $scope.panel.error = $scope.parse_error(results.error);
          return;
        }

        // Check that we're still on the same query, if not stop
        if($scope.query_id === query_id) {
          $scope.data= $scope.data.concat(_.map(results.hits.hits, function(hit) {
            return flatten_json(hit['_source']);
          }));

          $scope.hits += results.hits.total;

          // Sort the data
          $scope.data = _.sortBy($scope.data, function(v){
            return v[$scope.panel.sort[0]]
          });

          // Reverse if needed
          if($scope.panel.sort[1] == 'desc')
            $scope.data.reverse();

          // Keep only what we need for the set
          $scope.data = $scope.data.slice(0,$scope.panel.size * $scope.panel.pages)

        } else {
          return;
        }
        $scope.$emit('render')
      });



    };

    // I really don't like this function, too much dom manip. Break out into directive?
    $scope.populate_modal = function (request) {
      $scope.modal = {
        title: "Inspector",
        body: "<h5>Last Elasticsearch Query</h5><pre>" + 'curl -XGET ' + config.elasticsearch + '/' + $scope.index + "/_search?pretty -d'\n" + angular.toJson(JSON.parse(request.toString()), true) + "'</pre>"
      }
    };

    function set_time(time) {
      $scope.time = time;
      $scope.index = _.isUndefined(time.index) ? $scope.index : time.index
      $scope.get_data();
    }


    $scope.$watch('activeDocs', function(v) {
      eventBus.broadcast($scope.$id,$scope.panel.group,"table_documents",
        {query:$scope.panel.query,docs:$scope.activeDocs});
    });

  })
  .directive('parallelcoordinates', function () {
    return {
      restrict: 'A',
      link: function (scope, elem, attrs) {

        //used to store a variety of directive-level variables
        var directive = {};

        scope.initializing = false;


        /**
         * Initialize the panels if new, or render existing panels
         */
        scope.init_or_render = function() {
          if (typeof directive.svg === 'undefined') {

            //prevent duplicate initialization steps, if render is called again
            //before the svg is setup
            if (!scope.initializing) {
              init_panel();
            }
          } else {
            render_panel();
          }
        };


        /**
         * Receive render events
         */
        scope.$on('render', function () {
          scope.init_or_render();
        });

        /**
         * On window resize, re-render the panel
         */
        angular.element(window).bind('resize', function () {
          scope.init_or_render();
        });


        /**
         * Load the various panel-specific scripts then initialize
         * the svg and set appropriate D3 settings
         */
        function init_panel() {

          directive.m = [80, 100, 80, 100];
          directive.w = $(elem[0]).width() - directive.m[1] - directive.m[3];
          directive.h = $(elem[0]).height() - directive.m[0] - directive.m[2];


          scope.initializing = true;
          // Using LABjs, wait until all scripts are loaded before rendering panel
          var scripts = $LAB.script("common/lib/d3.v3.min.js?rand="+Math.floor(Math.random()*10000));

          scripts.wait(function () {

            directive.x = d3.scale.ordinal().domain(scope.panel.fields).rangePoints([0, directive.w]);
            directive.y = {};

            directive.line = d3.svg.line().interpolate('cardinal');
            directive.axis = d3.svg.axis().orient("left");

            var viewbox = "0 0 " + (directive.w + directive.m[1] + directive.m[3]) + " " + (directive.h + directive.m[0] + directive.m[2]);
            directive.svg = d3.select(elem[0]).append("svg")
              .attr("width", "100%")
              .attr("height", "100%")
              .attr("viewbox", viewbox)
              .append("svg:g")
              .attr("transform", "translate(" + directive.m[3] + "," + directive.m[0] + ")");

            // Add foreground lines.
            directive.foreground = directive.svg.append("svg:g")
              .attr("class", "foreground");

            scope.initializing = false;
            render_panel();
          });


        }

        // Returns the path for a given data point.
        function path(d) {
          return directive.line(scope.panel.fields.map(function(p) { return [directive.x(p), directive.y[p](d[p])]; }));
        }

        // Handles a brush event, toggling the display of foreground lines.
        function brush() {
          var actives = scope.panel.fields.filter(function(p) { return !directive.y[p].brush.empty(); }),
            extents = actives.map(function(p) { return directive.y[p].brush.extent(); });

          //.fade class hides the "inactive" lines, helps speed up rendering significantly
          directive.foregroundLines.classed("fade", function(d) {
            return !actives.every(function(p, i) {

              var pointValue;

              if (directive.ordinals[p] === true) {
                pointValue = directive.y[p](d[p]);
              } else {
                pointValue = d[p];
              }

              var inside = extents[i][0] <= pointValue && pointValue <= extents[i][1];
              return inside;
            });
          });

          //activeDocs contains the actual doc records for selected lines.
          //will be broadcast out to the table
          var activeDocs = _.filter(scope.data, function(v) {
            return actives.every(function(p,i) {
              var inside = extents[i][0] <= v[p] && v[p] <= extents[i][1];
              return inside;
            });
          })

          scope.$apply(function() {
            scope.activeDocs = activeDocs;
          });
        }


        //Drag functions are used for dragging the axis aroud
        function dragstart(d) {
          directive.i = scope.panel.fields.indexOf(d);
        }

        function drag(d) {
          directive.x.range()[directive.i] = d3.event.x;
          scope.panel.fields.sort(function(a, b) { return directive.x(a) - directive.x(b); });
          directive.foregroundLines.attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
          directive.traits.attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
          directive.brushes.attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
          directive.axisLines.attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
          directive.foregroundLines.attr("d", path);
        }

        function dragend(d) {
          directive.x.domain(scope.panel.fields).rangePoints([0, directive.w]);
          var t = d3.transition().duration(500);
          t.selectAll(".trait").attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
          t.selectAll(".axis").attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
          t.selectAll(".brush").attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
          t.selectAll(".foregroundlines").attr("d", path);
        }




        /**
         * Render updates to the SVG. Typically happens when the data changes (time, query)
         * or when new options are selected
         */
        function render_panel() {


          //update the svg if the size has changed
          directive.w = $(elem[0]).width() - directive.m[1] - directive.m[3];
          directive.h = $(elem[0]).height() - directive.m[0] - directive.m[2];
          directive.svg.attr("viewbox", "0 0 " + (directive.w + directive.m[1] + directive.m[3]) + " " + (directive.h + directive.m[0] + directive.m[2]));


          directive.x = d3.scale.ordinal().domain(scope.panel.fields).rangePoints([0, directive.w]);
          directive.y = {};

          directive.line = d3.svg.line().interpolate('cardinal');
          directive.axis = d3.svg.axis().orient("left").ticks(5);
          directive.ordinals = {};

          scope.panel.fields.forEach(function(d) {
            var firstField = scope.data[0][d];

            if (_.isString(firstField)) {
              if (isValidDate(new Date(firstField))) {

                //convert date timestamps to actual dates
                _.map(scope.data, function(v) {
                  v[d] = new Date(v[d]);
                });

                var extents = d3.extent(scope.data, function(p) { return p[d]; });

                directive.y[d] = d3.time.scale()
                  .domain([extents[0],extents[1]])
                  .range([directive.h, 0]);

              } else {
                directive.ordinals[d] = true;

                var value = function(v) { return v[d]; };
                var values = _.map(_.uniq(scope.data, value),value);

                directive.y[d] = d3.scale.ordinal()
                  .domain(values)
                  .rangePoints([directive.h, 0]);

              }

            } else if (_.isNumber(firstField)) {
              directive.y[d] = d3.scale.linear()
                .domain(d3.extent(scope.data, function(p) { return +p[d]; }))
                .range([directive.h, 0]);

            } else if (_.isDate(firstField)) {
              //this section is only used after timestamps have been parsed into actual date objects...
              //avoids reparsing

              var extents = d3.extent(scope.data, function(p) { return p[d]; });

              directive.y[d] = d3.time.scale()
                .domain([extents[0],extents[1]])
                .range([directive.h, 0]);

            }

            directive.y[d].brush = d3.svg.brush()
              .y(directive.y[d])
              .on("brush", brush);
          });

          //setup the colors for the lines
          setColors();

          //pull out the actively selected columns for rendering the axis/lines
          var activeData = _.map(scope.data, function(d) {
            var t = {};
            _.each(scope.panel.fields, function(f) {
              t[f] = d[f];
            });
            return t;
          });


          //Lines
          directive.foregroundLines = directive.foreground
            .selectAll(".foregroundlines")
            .data(activeData, function(d, i){
              var id = "";
              _.each(d, function(v) {
                id += i + "_" + v;
              });
              return id;
            });
          directive.foregroundLines
            .enter().append("svg:path")
            .attr("d", path)
            .attr("class", "foregroundlines")
            .attr("style", function(d) {
              return "stroke:" + directive.colors(d[scope.panel.fields[0]]) + ";";
            });
          directive.foregroundLines.exit().remove();



          //Axis group
          directive.traits = directive.svg.selectAll(".trait")
            .data(scope.panel.fields, String);
          directive.traits
            .enter().append("svg:g")
            .attr("class", "trait")
            .attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
          directive.traits
            .exit().remove();


          //brushes used to select lines
          directive.brushes = directive.svg.selectAll(".brush")
            .data(scope.panel.fields, String);
          directive.brushes
            .enter()
            .append("svg:g")
            .attr("class", "brush")
            .each(function(d) {
              d3.select(this)
                .call(directive.y[d].brush)
                .attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
            })
            .selectAll("rect")
            .attr("x", -8)
            .attr("width", 16);

          //this section is repeated because enter() only works on "new" data, but we always need to
          //update the brushes if things change.  This just calls the brushing function, so it doesn't
          //affect currently active rects
          directive.brushes
            .each(function(d) {
              d3.select(this)
                .call(directive.y[d].brush)
                .attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
            });
          directive.brushes
            .exit().remove();


          //vertical axis and labels
          directive.axisLines =  directive.svg.selectAll(".axis")
            .data(scope.panel.fields, String);
          directive.axisLines
            .enter()
            .append("svg:g")
            .attr("class", "axis")
            .each(function(d) {
              d3.select(this)
                .call(directive.axis.scale(directive.y[d]))
                .attr("transform", function(d) { return "translate(" + directive.x(d) + ")"; });
            }).call(d3.behavior.drag()
              .origin(function(d) { return {x: directive.x(d)}; })
              .on("dragstart", dragstart)
              .on("drag", drag)
              .on("dragend", dragend))

            .append("svg:text")
            .attr("text-anchor", "middle")
            .attr("y", -9)
            .text(String);
          directive.axisLines
            .exit().remove();

          //Simulate a dragend in case there is new data and we need to rearrange
          dragend();

        }

        function setColors() {

          var firstPanelField = scope.data[0][scope.panel.fields[0]];
          var extents = d3.extent(scope.data, function(p) { return p[scope.panel.fields[0]]; });

          if (_.isString(firstPanelField)) {

            var value = function(v) { return v[firstPanelField]; };
            var values = _.map(_.uniq(scope.data, value),value);

            values = scope.data;
            directive.colors = d3.scale.ordinal()
              .domain(values)
              .range(d3.range(values.length).map(d3.scale.linear()
                .domain([0, values.length - 1])
                .range(["red", "blue"])
                .interpolate(d3.interpolateLab)));

          } else if (_.isNumber(firstPanelField)) {
            directive.colors = d3.scale.linear()
              .domain([extents[0],extents[1]])
              .range(["#4580FF", "#FF9245"]);

          } else if (_.isDate(firstPanelField)) {
            directive.colors = d3.time.scale()
              .domain([extents[0],extents[1]])
              .range(["#4580FF", "#FF9245"]);
          }

        }

        function isValidDate(d) {
          if ( Object.prototype.toString.call(d) !== "[object Date]" )
            return false;
          return !isNaN(d.getTime());
        }

      }
    };
  });