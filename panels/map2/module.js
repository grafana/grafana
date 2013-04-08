angular.module('kibana.map2', [])
    .controller('map2', function ($scope, eventBus) {

        // Set and populate defaults
        var _d = {
            query: "*",
            map: "world",
            colors: ['#C8EEFF', '#0071A4'],
            size: 100,
            exclude: [],
            spyable: true,
            group: "default",
            index_limit: 0,
            display: {
                translate:[0, 0],
                scale:-1,
                data: {
                  samples: 1000
                },
                geopoints: {
                    enabled: true,
                    enabledText: "Enabled",
                    pointSize: 0.3,
                    pointAlpha: 0.6
                },
                binning: {
                    enabled: true,
                    hexagonSize: 2,
                    hexagonAlpha: 1.0,
                    areaEncoding: true,
                    areaEncodingField: "primary",
                    colorEncoding: true,
                    colorEncodingField: "primary"
                },
                choropleth: {
                    enabled: false
                },
                bullseye: {
                    enabled: false
                }
            },
            displayTabs: ["Geopoints", "Binning", "Choropleth", "Bullseye", "Data"],
            activeDisplayTab:"Geopoints"
        };

        _.defaults($scope.panel, _d)

        $scope.init = function () {
            eventBus.register($scope, 'time', function (event, time) {
                set_time(time)
            });
            eventBus.register($scope, 'query', function (event, query) {
                $scope.panel.query = _.isArray(query) ? query[0] : query;
                $scope.get_data();
            });
            // Now that we're all setup, request the time from our group
            eventBus.broadcast($scope.$id, $scope.panel.group, 'get_time')
        };

        $scope.isNumber = function (n) {
            return !isNaN(parseFloat(n)) && isFinite(n);
        };

        $scope.get_data = function () {

            // Make sure we have everything for the request to complete
            if (_.isUndefined($scope.panel.index) || _.isUndefined($scope.time))
                return

            $scope.panel.loading = true;
            var request = $scope.ejs.Request().indices($scope.panel.index);


            //Use a regular term facet if there is no secondary field
            if (typeof $scope.panel.secondaryfield === "undefined") {
                var facet = $scope.ejs.TermsFacet('map')
                    .field($scope.panel.field)
                    .size($scope.panel.display.data.samples)
                    .exclude($scope.panel.exclude)
                    .facetFilter(ejs.QueryFilter(
                        ejs.FilteredQuery(
                            ejs.QueryStringQuery($scope.panel.query || '*'),
                            ejs.RangeFilter($scope.time.field)
                                .from($scope.time.from)
                                .to($scope.time.to))));
            } else {
                //otherwise, use term stats
                //NOTE: this will break if valueField is a geo_point
                //      need to put in checks for that
                var facet = $scope.ejs.TermStatsFacet('map')
                    .keyField($scope.panel.field)
                    .valueField($scope.panel.secondaryfield)
                    .size($scope.panel.display.data.samples)
                    .facetFilter(ejs.QueryFilter(
                        ejs.FilteredQuery(
                            ejs.QueryStringQuery($scope.panel.query || '*'),
                            ejs.RangeFilter($scope.time.field)
                                .from($scope.time.from)
                                .to($scope.time.to))));
            }


            // Then the insert into facet and make the request
            var request = request.facet(facet).size(0);

            $scope.populate_modal(request);

            var results = request.doSearch();

            // Populate scope when we have results
            results.then(function (results) {
                $scope.panel.loading = false;
                $scope.hits = results.hits.total;
                $scope.data = {};

                _.each(results.facets.map.terms, function (v) {

                    var metric = 'count';

                    //If it is a Term facet, use count, otherwise use Total
                    //May retool this to allow users to pick mean/median/etc
                    if (typeof $scope.panel.secondaryfield === "undefined") {
                        metric = 'count';
                    } else {
                        metric = 'total';
                    }

                    //FIX THIS
                    if (!$scope.isNumber(v.term)) {
                        $scope.data[v.term.toUpperCase()] = v[metric];
                    } else {
                        $scope.data[v.term] = v[metric];
                    }
                });

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

        $scope.build_search = function (field, value) {
            $scope.panel.query = add_to_query($scope.panel.query, field, value, false)
            $scope.get_data();
            eventBus.broadcast($scope.$id, $scope.panel.group, 'query', $scope.panel.query);
        };

        $scope.isActive = function(tab) {
            return (tab.toLowerCase() === $scope.panel.activeDisplayTab.toLowerCase());
        }

        $scope.tabClick = function(tab) {
            $scope.panel.activeDisplayTab = tab;
        }

    })
    .filter('enabledText', function() {
        return function (value) {
            if (value === true) {
                return "Enabled";
            } else {
                return "Disabled";
            }
        }
    })
    .directive('map2', function () {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {

                elem.html('<center><img src="common/img/load_big.gif"></center>')

                scope.worldData = null;
                scope.worldNames = null;
                scope.svg = null;
                scope.g = null;

                // Receive render events
                scope.$on('render', function () {
                    render_panel();
                });

                // Or if the window is resized
                angular.element(window).bind('resize', function () {
                    render_panel();
                });

                function render_panel() {

                    // Using LABjs, wait until all scripts are loaded before rendering panel
                    var scripts = $LAB.script("panels/map2/lib/d3.v3.min.js")
                        .script("panels/map2/lib/topojson.v1.min.js")
                        .script("panels/map2/lib/node-geohash.js")
                        .script("panels/map2/lib/d3.hexbin.v0.min.js")
                        .script("panels/map2/lib/queue.v1.min.js")
                        .script("panels/map2/display/binning.js")
                        .script("panels/map2/display/geopoints.js");

                    // Populate element. Note that jvectormap appends, does not replace.
                    scripts.wait(function () {
                        elem.text('');

                        //these files can take a bit of time to process, so save them in a variable
                        //and use those on redraw
                        if (scope.worldData === null || scope.worldNames === null) {
                            queue()
                                .defer(d3.json, "panels/map2/lib/world-110m.json")
                                .defer(d3.tsv, "panels/map2/lib/world-country-names.tsv")
                                .await(function(error, world, names) {
                                    scope.worldData = world;
                                    scope.worldNames = names;
                                    ready();
                                });
                        } else {
                            ready();
                        }
                    });
                }

                /**
                 * All map data has been loaded, go ahead and draw the map/data
                 */
                function ready() {



                    var world = scope.worldData,
                        names = scope.worldNames;

                    //Better way to get these values?  Seems kludgy to use jQuery on the div...
                    var width = $(elem[0]).width(),
                        height = $(elem[0]).height();

                    //scale to whichever dimension is smaller, helps to ensure the whole map is displayed
                    var scale = (width > height) ? (height / 2 / Math.PI) : (width / 2 / Math.PI);


                    /**
                     * D3 and general config section
                     */
                    var projection = d3.geo.mercator()
                        .translate([0,0])
                        .scale(scale);

                    var zoom = d3.behavior.zoom()
                        .scaleExtent([1, 8])
                        .on("zoom", move);

                    var path = d3.geo.path()
                        .projection(projection);

                    //used by choropleth
                    var quantize = d3.scale.quantize()
                        .domain([0, 1000])
                        .range(d3.range(9).map(function(i) { return "q" + (i+1); }));


                    //Extract name and two-letter codes for our countries
                    var countries = topojson.feature(world, world.objects.countries).features;

                    countries = countries.filter(function(d) {
                        return names.some(function(n) {
                            if (d.id == n.id) {
                                d.name = n.name;
                                return d.short = n.short;
                            }
                        });
                    }).sort(function(a, b) {
                        return a.name.localeCompare(b.name);
                    });

                    //Geocoded points are decoded into lat/lon, then projected onto x/y
                    points = _.map(scope.data, function (k, v) {
                        var decoded = geohash.decode(v);
                        return projection([decoded.longitude, decoded.latitude]);
                    });




                    /**
                     * D3 SVG Setup
                     */

                    //remove our old svg...is there a better way to update than remove/append?
                    d3.select(elem[0]).select("svg").remove();

                    //create the new svg
                    scope.svg = d3.select(elem[0]).append("svg")
                        .attr("width", width)
                        .attr("height", height)
                        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
                        .call(zoom);

                    scope.g = scope.svg.append("g");

                    //Overlay is used so that the entire map is draggable, not just the locations
                    //where countries are
                    scope.svg.append("rect")
                        .attr("class", "overlay")
                        .attr("x", -width / 2)
                        .attr("y", -height / 2)
                        .attr("width", width)
                        .attr("height", height);

                    //Draw the countries, if this is a choropleth, draw with fancy colors
                    scope.g.selectAll("path")
                        .data(countries)
                        .enter().append("path")
                        .attr("class", function(d) {
                            if (scope.panel.display.choropleth.enabled) {
                                return 'land ' + quantize(scope.data[d.short]);
                            } else {
                                return 'land';
                            }
                        })
                        .attr("d", path);

                    //draw boundaries
                    scope.g.selectAll("land").append("path")
                        .datum(topojson.mesh(world, world.objects.land, function(a, b) { return a !== b; }))
                        .attr("class", "land boundary")
                        .attr("d", path);



                    /**
                     * Display Options
                     */

                    //Hexagonal Binning
                    if (scope.panel.display.binning.enabled) {
                        var dimensions = [width, height];
                        displayBinning(scope, dimensions, projection);
                    }

                    //Raw geopoints
                    if (scope.panel.display.geopoints.enabled) {
                        displayGeopoints(scope);
                    }


                    /**
                     * Zoom Functionality
                     */
                    if (scope.panel.display.scale != -1) {
                        zoom.scale(scope.panel.display.scale).translate(scope.panel.display.translate);
                        scope.g.style("stroke-width", 1 / scope.panel.display.scale).attr("transform", "translate(" + scope.panel.display.translate + ") scale(" + scope.panel.display.scale + ")");

                    }

                    function move() {
                        var t = d3.event.translate,
                            s = d3.event.scale;
                        t[0] = Math.min(width / 2 * (s - 1), Math.max(width / 2 * (1 - s), t[0]));
                        t[1] = Math.min(height / 2 * (s - 1) + 230 * s, Math.max(height / 2 * (1 - s) - 230 * s, t[1]));
                        zoom.translate(t);

                        scope.panel.display.translate = t;
                        scope.panel.display.scale = s;
                        scope.g.style("stroke-width", 1 / s).attr("transform", "translate(" + t + ")scale(" + s + ")");
                    }

                }
            }
        };
    });