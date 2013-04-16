angular.module('kibana.parallelcoordinates', [])
    .controller('parallelcoordinates', function ($scope, eventBus) {

        console.log("controller");


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
            spyable: true,
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



    })
    .directive('parallelcoordinates', function () {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {

                console.log("directive");

                //elem.html('')
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



                var species = ["setosa", "versicolor", "virginica"],
                    traits = ["sepal length", "petal length", "sepal width", "petal width"];

                var m = [80, 160, 200, 160],
                    w = 1280 - m[1] - m[3],
                    h = 800 - m[0] - m[2];

                var x, y,line,axis,foreground,svg;



                /**
                 * Load the various panel-specific scripts then initialize
                 * the svg and set appropriate D3 settings
                 */
                function init_panel() {

                    console.log("init");
                    console.log("fields", scope.panel.fields);

                    scope.initializing = true;
                    // Using LABjs, wait until all scripts are loaded before rendering panel
                    var scripts = $LAB.script("common/lib/d3.v3.min.js?rand="+Math.floor(Math.random()*10000))
                        .script("panels/parallelcoordinates/lib/d3.csv.js?rand="+Math.floor(Math.random()*10000));

                    scripts.wait(function () {


                        console.log("scripts loaded");

                        x = d3.scale.ordinal().domain(traits).rangePoints([0, w]);
                        y = {};

                        line = d3.svg.line();
                        axis = d3.svg.axis().orient("left");


                        svg = d3.select(elem[0]).append("svg")
                            .attr("width", "100%")
                            .attr("height", "100%")
                            .attr("viewbox", "0 0 " + (w + m[1] + m[3]) + " " + (h + m[0] + m[2]))
                            .append("svg:g")
                            .attr("transform", "translate(" + m[3] + "," + m[0] + ")");



                            console.log("loaded");

                            //console.log(flowers);
                            // Create a scale and brush for each trait.
                        scope.panel.fields.forEach(function(d) {
                            console.log("extent", d3.extent(scope.data, function(p) { return +p[d]; }));
                                y[d] = d3.scale.linear()
                                    .domain(d3.extent(scope.data, function(p) { return +p[d]; }))
                                    .range([h, 0]);

                                y[d].brush = d3.svg.brush()
                                    .y(y[d])
                                    .on("brush", brush);
                            });
                        console.log("y", y);


                            // Add foreground lines.
                            foreground = svg.append("svg:g")
                                .attr("class", "foreground")
                                .selectAll("path")
                                .data(scope.data)
                                .enter().append("svg:path")
                                .attr("d", path)
                                .attr("class", 'setosa');

                            // Add a group element for each trait.
                        scope.g = svg.selectAll(".trait")
                                .data(scope.panel.fields)
                                .enter().append("svg:g")
                                .attr("class", "trait")
                                .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
                                .call(d3.behavior.drag()
                                    .origin(function(d) { return {x: x(d)}; })
                                    .on("dragstart", dragstart)
                                    .on("drag", drag)
                                    .on("dragend", dragend));


                        // Add a brush for each axis.
                        scope.g.append("svg:g")
                            .attr("class", "brush")
                            .each(function(d) { d3.select(this).call(y[d].brush); })
                            .selectAll("rect")
                            .attr("x", -8)
                            .attr("width", 16);


                            // Add an axis and title.
                        scope.g.append("svg:g")
                                .attr("class", "axis")
                                .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
                                .append("svg:text")
                                .attr("text-anchor", "middle")
                                .attr("y", -9)
                                .text(String);



                        scope.initializing = false;
                        render_panel();
                    });


                }

                // Returns the path for a given data point.
                function path(d) {
                    return line(scope.panel.fields.map(function(p) { return [x(p), y[p](d[p])]; }));
                }

// Handles a brush event, toggling the display of foreground lines.
                function brush() {
                    var actives = scope.panel.fields.filter(function(p) { return !y[p].brush.empty(); }),
                        extents = actives.map(function(p) { return y[p].brush.extent(); });


                    foreground.classed("fade", function(d) {
                        return !actives.every(function(p, i) {
                            return extents[i][0] <= d[p] && d[p] <= extents[i][1];
                        });
                    });
                }

                function dragstart(d) {
                    i = scope.panel.fields.indexOf(d);
                }

                function drag(d) {
                    x.range()[i] = d3.event.x;
                    scope.panel.fields.sort(function(a, b) { return x(a) - x(b); });
                    scope.g.attr("transform", function(d) { return "translate(" + x(d) + ")"; });
                    foreground.attr("d", path);
                }

                function dragend(d) {
                    x.domain(scope.panel.fields).rangePoints([0, w]);
                    var t = d3.transition().duration(500);
                    t.selectAll(".trait").attr("transform", function(d) { return "translate(" + x(d) + ")"; });
                    t.selectAll(".foreground path").attr("d", path);
                }




                /**
                 * Render updates to the SVG. Typically happens when the data changes (time, query)
                 * or when new options are selected
                 */
                function render_panel() {

                    var width = $(elem[0]).width(),
                        height = $(elem[0]).height();

                }

            }
        };
    });