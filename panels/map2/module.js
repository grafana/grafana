angular.module('kibana.map2', [])
  .controller('map2', function ($scope, eventBus, keylistener) {

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
          samples: 1000,
          type: "mercator"
        },
        geopoints: {
          enabled: false,
          enabledText: "Enabled",
          pointSize: 0.3,
          pointAlpha: 0.6
        },
        binning: {
          enabled: false,
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
          enabled: false,
          coord: {
            lat: 0,
            lon: 0
          }
        }
      },
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
      eventBus.broadcast($scope.$id, $scope.panel.group, 'get_time');

      $scope.keylistener = keylistener;

    };

    $scope.get_data = function () {

      // Make sure we have everything for the request to complete
      if (_.isUndefined($scope.panel.index) || _.isUndefined($scope.time))
        return

      $scope.panel.loading = true;
      var request = $scope.ejs.Request().indices($scope.panel.index);


      var metric = 'count';

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

        metric = 'count';
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

        metric = 'total';
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

          if (!_.isNumber(v.term)) {
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

        //directive level variables related to d3
        var dr = {};

        scope.initializing = false;


        dr.worldData = null;
        dr.worldNames = null;

        //These are various options that should not be cached in scope.panel
        dr.options = {

          data: {
            dropdown:[
              {
                "text": "Mercator (Flat)",
                id: "mercator"
              },
              {
                text: "Orthographic (Sphere)",
                id: "orthographic"
              }
            ]
          }
        };


        /**
         * Initialize the panels if new, or render existing panels
         */
        scope.init_or_render = function() {
          if (typeof dr.svg === 'undefined') {
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
          scope.init_or_render();
        });

        /**
         * On window resize, re-render the panel
         */
        angular.element(window).bind('resize', function () {
          scope.init_or_render();
        });


        /**
         * Load the various panel-specific scripts, map data, then initialize
         * the svg and set appropriate D3 settings
         */
        function init_panel() {

          scope.initializing = true;
          // Using LABjs, wait until all scripts are loaded before rendering panel
          var scripts = $LAB.script("common/lib/d3.v3.min.js?rand="+Math.floor(Math.random()*10000))
            .script("panels/map2/lib/topojson.v1.min.js?rand="+Math.floor(Math.random()*10000))
            .script("panels/map2/lib/node-geohash.js?rand="+Math.floor(Math.random()*10000))
            .script("panels/map2/lib/d3.hexbin.v0.min.js?rand="+Math.floor(Math.random()*10000))
            .script("panels/map2/lib/queue.v1.min.js?rand="+Math.floor(Math.random()*10000))
            .script("panels/map2/display/binning.js?rand="+Math.floor(Math.random()*10000))
            .script("panels/map2/display/geopoints.js?rand="+Math.floor(Math.random()*10000))
            .script("panels/map2/display/bullseye.js?rand="+Math.floor(Math.random()*10000));

          // Populate element. Note that jvectormap appends, does not replace.
          scripts.wait(function () {

            queue()
              .defer(d3.json, "panels/map2/lib/world-110m.json")
              .defer(d3.tsv, "panels/map2/lib/world-country-names.tsv")
              .await(function(error, world, names) {
                dr.worldData = world;
                dr.worldNames = names;

                //Better way to get these values?  Seems kludgy to use jQuery on the div...
                var width = $(elem[0]).width(),
                  height = $(elem[0]).height();

                //scale to whichever dimension is smaller, helps to ensure the whole map is displayed
                dr.scale = (width > height) ? (height/5) : (width/5);

                dr.zoom = d3.behavior.zoom()
                  .scaleExtent([1, 20])
                  .on("zoom", translate_map);

                //used by choropleth
                //@todo change domain so that it reflects the domain of the data
                dr.quantize = d3.scale.quantize()
                  .domain([0, 1000])
                  .range(d3.range(9).map(function(i) { return "q" + (i+1); }));

                //Extract name and two-letter codes for our countries
                dr.countries = topojson.feature(dr.worldData, dr.worldData.objects.countries).features;

                dr.countries = dr.countries.filter(function(d) {
                  return dr.worldNames.some(function(n) {
                    if (d.id == n.id) {
                      d.name = n.name;
                      return d.short = n.short;
                    }
                  });
                }).sort(function(a, b) {
                    return a.name.localeCompare(b.name);
                  });

                //create the new svg
                dr.svg = d3.select(elem[0]).append("svg")
                  .attr("width", "100%")
                  .attr("height", "100%")
                  .attr("viewBox", "0 0 " + width + " " + height)
                  .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
                  .call(dr.zoom);
                dr.g = dr.svg.append("g");

                scope.initializing = false;
                render_panel();
              });
          });
        }


        /**
         * Render updates to the SVG. Typically happens when the data changes (time, query)
         * or when new options are selected
         */
        function render_panel() {

          var width = $(elem[0]).width(),
            height = $(elem[0]).height();

          //Projection is dependant on the map-type
          if (scope.panel.display.data.type === 'mercator') {
            dr.projection = d3.geo.mercator()
              .translate([width/2, height/2])
              .scale(dr.scale);

          } else if (scope.panel.display.data.type === 'orthographic') {
            dr.projection = d3.geo.orthographic()
              .translate([width/2, height/2])
              .scale(100)
              .clipAngle(90);

            //recenters the sphere more towards the US...not really necessary
            dr.projection.rotate([100 / 2, 20 / 2, dr.projection.rotate()[2]]);

          }

          dr.path = d3.geo.path()
            .projection(dr.projection).pointRadius(0.2);

          console.log(scope.data);

          //Geocoded points are decoded into lonlat
          dr.points = _.map(scope.data, function (k, v) {
            //console.log(k,v);
            var decoded = geohash.decode(v);
            return [decoded.longitude, decoded.latitude];
          });

          //And also projected projected to x/y.  Both sets of points are used
          //by different functions
          dr.projectedPoints = _.map(dr.points, function (coords) {
            return dr.projection(coords);
          });

          dr.svg.select(".overlay").remove();

          dr.svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");


          //Draw the countries, if this is a choropleth, draw with fancy colors
          var countryPath = dr.g.selectAll(".land")
            .data(dr.countries);

          countryPath.enter().append("path")
            .attr("class", function(d) {
              if (scope.panel.display.choropleth.enabled) {
                return 'land ' + dr.quantize(scope.data[d.short]);
              } else {
                return 'land';
              }
            })
            .attr("d", dr.path);

          countryPath.exit().remove();

          //If this is a sphere, set up drag and keypress listeners
          if (scope.panel.display.data.type === 'orthographic') {
            dr.svg.style("cursor", "move")
              .call(d3.behavior.drag()
                .origin(function() { var rotate = dr.projection.rotate(); return {x: 2 * rotate[0], y: -2 * rotate[1]}; })
                .on("drag", function() {
                  if (scope.keylistener.keyActive(17)) {
                    dr.projection.rotate([d3.event.x / 2, -d3.event.y / 2, dr.projection.rotate()[2]]);

                    //dr.svg.selectAll("path").attr("d", dr.path);
                    dr.g.selectAll("path").attr("d", dr.path);

                  }
                   }));


          }

          //Special fix for when the user changes from mercator -> orthographic
          //The globe won't redraw automatically, we need to force it
          if (scope.panel.display.data.type === 'orthographic') {
            //dr.svg.selectAll("path").attr("d", dr.path);
          }


          /**
           * Display option rendering
           * Order is important to render order here!
           */

          //@todo fix this
          var dimensions = [width, height];
          displayBinning(scope, dr, dimensions);
          displayGeopoints(scope, dr);
          displayBullseye(scope, dr);




          //If the panel scale is not default (e.g. the user has moved the maps around)
          //set the scale and position to the last saved config
          if (scope.panel.display.scale != -1) {
            dr.zoom.scale(scope.panel.display.scale).translate(scope.panel.display.translate);
            dr.g.style("stroke-width", 1 / scope.panel.display.scale).attr("transform", "translate(" + scope.panel.display.translate + ") scale(" + scope.panel.display.scale + ")");

          }

        }


        /**
         * On D3 zoom events, pan/zoom the map
         * Only applies if the ctrl-key is not pressed, so it doesn't clobber
         * sphere dragging
         */
        function translate_map() {

          var width = $(elem[0]).width(),
            height = $(elem[0]).height();

          if (! scope.keylistener.keyActive(17)) {
            var t = d3.event.translate,
              s = d3.event.scale;
            t[0] = Math.min(width / 2 * (s - 1), Math.max(width / 2 * (1 - s), t[0]));
            t[1] = Math.min(height / 2 * (s - 1) + 230 * s, Math.max(height / 2 * (1 - s) - 230 * s, t[1]));
            dr.zoom.translate(t);

            scope.panel.display.translate = t;
            scope.panel.display.scale = s;
            dr.g.style("stroke-width", 1 / s).attr("transform", "translate(" + t + ") scale(" + s + ")");
          }
        }
      }
    };
  });