angular.module('kibana.parallelcoordinates', [])
    .controller('parallelcoordinates', function ($scope, eventBus) {

        console.log("controller");

        $scope.activeDocs = [];

        // Set and populate defaults
        var _d = {
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
                console.log("selected_fields", fields);
                $scope.panel.fields = _.clone(fields)
                $scope.$emit('render');
            });
        };


        $scope.get_data = function (segment,query_id) {

            console.log("get_data");

            // Make sure we have everything for the request to complete
            if (_.isUndefined($scope.panel.index) || _.isUndefined($scope.time))
                return;

            var _segment = _.isUndefined(segment) ? 0 : segment
            $scope.segment = _segment;

            $scope.panel.loading = true;
            var request = $scope.ejs.Request().indices($scope.panel.index[_segment])
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
                console.log("emit render");


                console.log("data",$scope.data);
                $scope.$emit('render')
            });



        };

        // I really don't like this function, too much dom manip. Break out into directive?
        $scope.populate_modal = function (request) {
            $scope.modal = {
                title: "Inspector",
                body: "<h5>Last Elasticsearch Query</h5><pre>" + 'curl -XGET ' + config.elasticsearch + '/' + $scope.panel.index + "/_search?pretty -d'\n" + angular.toJson(JSON.parse(request.toString()), true) + "'</pre>"
            }
        };

        function set_time(time) {
            $scope.time = time;
            $scope.panel.index = _.isUndefined(time.index) ? $scope.panel.index : time.index
            $scope.get_data();
        }


        $scope.$watch('activeDocs', function(v) {
            //console.log("Watch", $scope.activeDocs);
            eventBus.broadcast($scope.$id,$scope.panel.group,"table_documents",
                {query:$scope.panel.query,docs:$scope.activeDocs});
        });

    })
    .directive('parallelcoordinates', function () {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {

                console.log("directive");
              
                scope.initializing = false;


                /**
                 * Initialize the panels if new, or render existing panels
                 */
                scope.init_or_render = function() {
                    if (typeof scope.svg === 'undefined') {
                        console.log("init");

                        //prevent duplicate initialization steps, if render is called again
                        //before the svg is setup
                        if (!scope.initializing) {
                            init_panel();
                        }
                    } else {
                        console.log("render");
                        render_panel();
                    }
                };


                /**
                 * Receive render events
                 */
                scope.$on('render', function () {
                    console.log("on render");
                    scope.init_or_render();
                });

                /**
                 * On window resize, re-render the panel
                 */
                angular.element(window).bind('resize', function () {
                    console.log("on resize");
                    scope.init_or_render();
                });






                /**
                 * Load the various panel-specific scripts then initialize
                 * the svg and set appropriate D3 settings
                 */
                function init_panel() {

                    scope.m = [80, 160, 200, 160];
                    scope.w = $(elem[0]).width() - scope.m[1] - scope.m[3],
                    scope.h = $(elem[0]).height() - scope.m[0] - scope.m[2];


                    console.log("init");
                    console.log("fields", scope.panel.fields);

                    scope.initializing = true;
                    // Using LABjs, wait until all scripts are loaded before rendering panel
                    var scripts = $LAB.script("common/lib/d3.v3.min.js?rand="+Math.floor(Math.random()*10000));

                    scripts.wait(function () {


                        scope.x = d3.scale.ordinal().domain(scope.panel.fields).rangePoints([0, scope.w]);
                        scope.y = {};

                        scope.line = d3.svg.line().interpolate('cardinal');
                        scope.axis = d3.svg.axis().orient("left");

                        scope.svg = d3.select(elem[0]).append("svg")
                            .attr("width", "100%")
                            .attr("height", "100%")
                            .attr("viewbox", "0 0 " + (scope.w + scope.m[1] + scope.m[3]) + " " + (scope.h + scope.m[0] + scope.m[2]))
                            .append("svg:g")
                            .attr("transform", "translate(" + scope.m[3] + "," + scope.m[0] + ")");

                        // Add foreground lines.
                        scope.foreground = scope.svg.append("svg:g")
                            .attr("class", "foreground");




                        scope.initializing = false;
                        console.log("init done");
                        render_panel();
                    });


                }

                // Returns the path for a given data point.
                function path(d) {
                    return scope.line(scope.panel.fields.map(function(p) { return [scope.x(p), scope.y[p](d[p])]; }));
                }

// Handles a brush event, toggling the display of foreground lines.
                function brush() {
                    var actives = scope.panel.fields.filter(function(p) { return !scope.y[p].brush.empty(); }),
                        extents = actives.map(function(p) { return scope.y[p].brush.extent(); });

                    scope.foregroundLines.classed("fade", function(d) {
                        return !actives.every(function(p, i) {
                            var inside = extents[i][0] <= d[p] && d[p] <= extents[i][1];
                            return inside;
                        });
                    });

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

                function dragstart(d) {
                    scope.i = scope.panel.fields.indexOf(d);
                    console.log("dragstart", d, scope.i)
                }

                function drag(d) {
                    console.log("drag", d, scope.i)
                    scope.x.range()[scope.i] = d3.event.x;
                    scope.panel.fields.sort(function(a, b) { return scope.x(a) - scope.x(b); });
                    scope.foregroundLines.attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                    scope.traits.attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                    scope.brushes.attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                    scope.axisLines.attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                    scope.foregroundLines.attr("d", path);
                }

                function dragend(d) {
                    console.log("dragend", d)
                    scope.x.domain(scope.panel.fields).rangePoints([0, scope.w]);
                    var t = d3.transition().duration(500);
                    t.selectAll(".trait").attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                    t.selectAll(".axis").attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                    t.selectAll(".brush").attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                    t.selectAll(".foregroundlines").attr("d", path);
                }




                /**
                 * Render updates to the SVG. Typically happens when the data changes (time, query)
                 * or when new options are selected
                 */
                function render_panel() {

                    console.log("render_panel");


                    scope.x = d3.scale.ordinal().domain(scope.panel.fields).rangePoints([0, scope.w]);
                    scope.y = {};

                    scope.line = d3.svg.line().interpolate('cardinal');
                    scope.axis = d3.svg.axis().orient("left");


                    var colorExtent = d3.extent(scope.data, function(p) { return +p['phpmemory']; });

                    scope.colors = d3.scale.linear()
                        .domain([colorExtent[0],colorExtent[1]])
                        .range(["#4580FF", "#FF9245"]);


                    scope.panel.fields.forEach(function(d) {
                        scope.y[d] = d3.scale.linear()
                            .domain(d3.extent(scope.data, function(p) { return +p[d]; }))
                            .range([scope.h, 0]);

                        scope.y[d].brush = d3.svg.brush()
                            .y(scope.y[d])
                            .on("brush", brush);
                    });

                    console.log("render y", scope.y);



                    var activeData = _.map(scope.data, function(d) {
                        var t = {};
                        _.each(scope.panel.fields, function(f) {
                            t[f] = d[f];
                        });
                        return t;
                    });


                    scope.foregroundLines = scope.foreground
                        .selectAll(".foregroundlines")
                        .data(activeData, function(d, i){
                            var id = "";
                            _.each(d, function(v) {
                               id += i + "_" + v;
                            });
                            return id;
                        });

                    scope.foregroundLines
                        .enter().append("svg:path")
                        .attr("d", path)
                        .attr("class", "foregroundlines")
                        .attr("style", function(d) {
                            return "stroke:" + scope.colors(d.phpmemory) + ";";
                        });

                    scope.foregroundLines.exit().remove();

                    console.log("Render Fields",scope.panel.fields);






                    scope.traits = scope.svg.selectAll(".trait")
                        .data(scope.panel.fields, String);

                    scope.traits
                        .enter().append("svg:g")
                        .attr("class", "trait")
                        .attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });






                    scope.brushes = scope.svg.selectAll(".brush")
                        .data(scope.panel.fields, String);

                    scope.brushes
                        .enter()
                        .append("svg:g")
                        .attr("class", "brush")
                        .each(function(d) {
                            d3.select(this)
                                .call(scope.y[d].brush)
                                .attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                        })
                        .selectAll("rect")
                        .attr("x", -8)
                        .attr("width", 16);

                    scope.brushes
                        .each(function(d) {
                            d3.select(this)
                                .call(scope.y[d].brush)
                                .attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                        });

                   scope.axisLines =  scope.svg.selectAll(".axis")
                        .data(scope.panel.fields, String);

                   scope.axisLines
                        .enter()
                        .append("svg:g")
                        .attr("class", "axis")
                        .each(function(d) {
                            console.log("axis",d)
                                d3.select(this)
                                    .call(scope.axis.scale(scope.y[d]))
                                    .attr("transform", function(d) { return "translate(" + scope.x(d) + ")"; });
                        }).call(d3.behavior.drag()
                           .origin(function(d) { return {x: scope.x(d)}; })
                           .on("dragstart", dragstart)
                           .on("drag", drag)
                           .on("dragend", dragend))

                        .append("svg:text")
                        .attr("text-anchor", "middle")
                        .attr("y", -9)
                        .text(String);



                    scope.brushes
                        .exit().remove();

                    scope.axisLines
                        .exit().remove();

                    scope.traits
                        .exit().remove();


                    dragend();




                }

            }
        };
    });