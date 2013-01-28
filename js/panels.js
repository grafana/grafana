/*jshint globalstrict:true */
/*global angular:true */
'use strict';

/* NOTE:  This is very much a preview, many things will change. In fact, this
          file will probably go away
*/

/* 
  METAPARAMETERS 

  If you're implementing a panel, these are used by default. You need not handle
  them in your directive.

  span:   The grid is made up of N rows, however there are only 12 columns. Span
          is a number, 1-12
  type:   This is the name of your directive.  
*/

/*
  Histogram

  Draw a histogram of a single query

  NOTE: This will likely be renamed or get a setting that allows for non-time
  based keys. It may also be updated to allow multiple stacked or unstacked
  queries. 

  query:    query to execute
  interval: Bucket size in the standard Nunit (eg 1d, 5m, 30s) Attempts to auto
            scale itself based on timespan
  color:    line/bar color.
  show:     array of what to show, (eg ['bars','lines','points']) 
*/

/* 
  Piequery  

  Use a query facets to compare counts of for different queries, then show them
  on a pie chart

  queries:    An array of queries
  donut:      Make a hole in the middle? 
  tilt:       Tilt the pie in a 3dish way
  legend:     Show it or not?
  colors:     An array of colors to use for slices. These map 1-to-1 with the #
              of queries in your queries array
*/

/* Pieterms

  Use a terms facet to calculate the most popular terms for a field

  query:    Query to perform the facet on
  size:     Limit to this many terms
  exclude:  An array of terms to exclude from the results
  donut:      Make a hole in the middle? 
  tilt:       Tilt the pie in a 3dish way
  legend:     Show it or not?
*/

/* Stackedquery

  Use date histograms to assemble stacked bar or line charts representing 
  multple queries over time

  queries:    An array of queries
  interval:   Bucket size in the standard Nunit (eg 1d, 5m, 30s) Attempts to auto
              scale itself based on timespan
  colors:     An array of colors to use for slices. These map 1-to-1 with the #
              of queries in your queries array
  show:       array of what to show, (eg ['bars','lines','points']) 
*/


angular.module('kibana.panels', [])
.directive('histogram', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Specify defaults for ALL directives
      var _d = {
        query   : "*",
        interval: secondsToHms(calculate_interval(scope.from,scope.to,40,0)/1000),
        color   : "#27508C",
        show    : ['bars']
      }

      // Set ready flag and fill parameters (REQUIRED IN EVERY PANEL)
      scope.$watch(function () {
        return (attrs.params && scope.index) ? true : false;
      }, function (ready) {
        scope.ready = ready;
        if(ready) {
          scope.params = JSON.parse(attrs.params);
          _.each(_d, function(v, k) {
            scope.params[k] = _.isUndefined(scope.params[k]) 
              ? _d[k] : scope.params[k];
          });
        }
      });

      // Also get the data if time frame changes.
      // (REQUIRED IN EVERY PANEL)
      scope.$watch(function() { 
        return angular.toJson([scope.from, scope.to, scope.ready]) 
      }, function(){
        if(scope.ready)
          if (_.isUndefined(attrs.params.interval))
            scope.params.interval = secondsToHms(
              calculate_interval(scope.from,scope.to,50,0)/1000),
          get_data(scope,elem,attrs);
      });

      // Re-rending the panel if it is resized,
      scope.$watch('data', function() {
          render_panel(scope,elem,attrs);
      });

      // Or if the model changes
      angular.element(window).bind('resize', function(){
          render_panel(scope,elem,attrs);
      });

      // Function for getting data
      function get_data(scope,elem,attrs) {
        var params = scope.params;
        var ejs = scope.ejs;
        var request = ejs.Request().indices(scope.index);
        
        // Build the question part of the query
        var query = ejs.FilteredQuery(
          ejs.QueryStringQuery(params.query || '*'),
          ejs.RangeFilter(config.timefield)
            .from(scope.from)
            .to(scope.to)
            .cache(false)
          );

        // Then the insert into facet and make the request
        var results = request
          .facet(ejs.DateHistogramFacet('histogram')
            .field(config.timefield)
            .interval(params.interval)
            .facetFilter(ejs.QueryFilter(query))
          )
          .doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          scope.hits = results.hits.total;
          scope.data = results.facets.histogram.entries;
        });
      }

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Parse our params object
        var params = scope.params;

        // Determine format
        var show = _.isUndefined(params.show) ? {
            bars: true, lines: false, points: false
          } : {
            lines:  _.indexOf(params.show,'lines') < 0 ? false : true,
            bars:   _.indexOf(params.show,'bars') < 0 ? false : true,
            points: _.indexOf(params.show,'points') < 0 ? false : true,
          }

        // Push null values at beginning and end of timeframe
        scope.graph = [
          [scope.from.getTime(), null],[scope.to.getTime(), null]];

        // Create FLOT value array 
        _.each(scope.data, function(v, k) {
          scope.graph.push([v['time'],v['count']])
        });

        // Set barwidth based on specified interval
        var barwidth = interval_to_seconds(params.interval)*1000

        // Populate element
        $.plot(elem, [{
          label: _.isUndefined(params.label) ? params.query: params.label, 
          data: scope.graph
        }], {
          legend: { 
            position: "nw", 
            labelFormatter: function(label, series) {
              return '<span class="legend">' + label + ' / ' + params.interval 
                + '</span>';
            }
          },
          series: {
            lines:  { show: show.lines, fill: false },
            bars:   { show: show.bars,  fill: 1, barWidth: barwidth/1.8 },
            points: { show: show.points },
            color: params.color,
            shadowSize: 1
          },
          yaxis: { min: 0, color: "#000" },
          xaxis: {
            mode: "time",
            timeformat: "%H:%M:%S<br>%m-%d",
            label: "Datetime",
            color: "#000",
          },
          grid: {
            backgroundColor: '#fff',
            borderWidth: 0,
            borderColor: '#eee',
            color: "#eee",
            hoverable: true,
          }
        });
        //elem.show();
      }
    }
  };
})
.directive('pieterms', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Specify defaults for ALL directives
      var _d = {
        size    : 5,
        query   : "*",
        exclude : [],
        donut   : false, 
        tilt    : false,
        legend  : true,
      }

      // Set ready flag and fill parameters (REQUIRED IN EVERY PANEL)
      scope.$watch(function () {
        return (attrs.params && scope.index) ? true : false;
      }, function (ready) {
        scope.ready = ready;
        if(ready) {
          scope.params = JSON.parse(attrs.params);
          _.each(_d, function(v, k) {
            scope.params[k] = _.isUndefined(scope.params[k]) 
              ? _d[k] : scope.params[k];
          });
        }
      });

      // Also get the data if time frame changes.
      // (REQUIRED IN EVERY PANEL)
      scope.$watch(function() { 
        return angular.toJson([scope.from, scope.to, scope.ready]) 
      }, function(){
        if(scope.ready)
          get_data(scope,elem,attrs);
      });

      // Re-rending the panel if it is resized,
      scope.$watch('data', function() {
          render_panel(scope,elem,attrs);
      });

      // Or if the model changes
      angular.element(window).bind('resize', function(){
          render_panel(scope,elem,attrs);
      });

      // Function for getting data
      function get_data(scope,elem,attrs) {
        var params = scope.params;
        var ejs = scope.ejs;
        var request = ejs.Request().indices(scope.index);
        
        // Build the question part of the query
        var query = ejs.FilteredQuery(
          ejs.QueryStringQuery(params.query || '*'),
          ejs.RangeFilter(config.timefield)
            .from(scope.from)
            .to(scope.to)
            .cache(false)
          );

        // Then the insert into facet and make the request
        var results = request
          .facet(ejs.TermsFacet('termpie')
            .field(params.field)
            .size(params['size'])
            .exclude(params.exclude)
            .facetFilter(ejs.QueryFilter(query))
          )
          .doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          scope.hits = results.hits.total;
          scope.data = results.facets.termpie.terms;
        });
      }

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Parse our params object
        var params = scope.params;

        // Create graph array
        scope.graph = [];
        _.each(scope.data, function(v, k) {
          if(!_.isUndefined(params.only) && _.indexOf(params.only,v['term']) < 0)
            return

          var point = {
            label : v['term'],
            data  : v['count']
          }

          if(!_.isUndefined(params.colors))
            point.color = params.colors[_.indexOf(params.only,v['term'])] 

          scope.graph.push(point)
        });

        var pie = {
          series: {
            pie: {
              innerRadius: params.donut ? 0.4 : 0,
              tilt: params.tilt ? 0.45 : 1,
              radius: 1,
              show: true,
              combine: {
                color: '#999',
                label: 'The Rest'
              },
              label: { 
                show: true,
                radius: 2/3,
                formatter: function(label, series){
                  return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                    label+'<br/>'+Math.round(series.percent)+'%</div>';
                },
                threshold: 0.1 
              }
            }
          },
          //grid: { hoverable: true, clickable: true },
          legend: { show: params.legend }
        };

        // Populate element
        $.plot(elem, scope.graph, pie);
        //elem.show();
      }
    }
  };
})
.directive('piequery', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Specify defaults for ALL directives
      var _d = {
        queries : ["*"],
        donut   : false, 
        tilt    : false,
        legend  : true,
      }

      // Set ready flag and fill parameters (REQUIRED IN EVERY PANEL)
      scope.$watch(function () {
        return (attrs.params && scope.index) ? true : false;
      }, function (ready) {
        scope.ready = ready;
        if(ready) {
          scope.params = JSON.parse(attrs.params);
          _.each(_d, function(v, k) {
            scope.params[k] = _.isUndefined(scope.params[k]) 
              ? _d[k] : scope.params[k];
          });
        }
      });

      // Also get the data if time frame changes.
      // (REQUIRED IN EVERY PANEL)
      scope.$watch(function() { 
        return angular.toJson([scope.from, scope.to, scope.ready]) 
      }, function(){
        if(scope.ready)
          get_data(scope,elem,attrs);
      });

      // Re-rending the panel if it is resized,
      scope.$watch('data', function() {
          render_panel(scope,elem,attrs);
      });

      // Or if the model changes
      angular.element(window).bind('resize', function(){
          render_panel(scope,elem,attrs);
      });

      // Function for getting data
      function get_data(scope,elem,attrs) {
        var params = scope.params;
        var ejs = scope.ejs;
        var request = ejs.Request().indices(scope.index);
        

        var queries = [];
        // Build the question part of the query
        _.each(params.queries, function(v) {
          queries.push(ejs.FilteredQuery(
            ejs.QueryStringQuery(v || '*'),
            ejs.RangeFilter(config.timefield)
              .from(scope.from)
              .to(scope.to)
              .cache(false))
          )
        });

        _.each(queries, function(v) {
          request = request.facet(ejs.QueryFacet(_.indexOf(queries,v))
            .query(v)
            .facetFilter(ejs.QueryFilter(v))
          )
        })
        // Then the insert into facet and make the request
        var results = request.doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          scope.hits = results.hits.total;
          scope.data = results.facets;
        });
      }

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Parse our params object
        var params = scope.params;

        // Create graph array
        scope.graph = [];
        _.each(scope.data, function(v, k) {
          var point = {
            label : params.queries[k],
            data  : v['count']
          }
          if(!_.isUndefined(params.colors))
            point.color = params.colors[k%params.colors.length];
          scope.graph.push(point)
        });

        // Populate element
        $.plot(elem, scope.graph, {
            series: {
              pie: {
                innerRadius: params.donut ? 0.4 : 0,
                tilt: params.tilt ? 0.45 : 1,
                radius: 1,
                show: true,
                combine: {
                  color: '#999',
                  label: 'The Rest'
                },
                label: { 
                  show: true,
                  radius: 2/3,
                  formatter: function(label, series){
                    return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                      label+'<br/>'+Math.round(series.percent)+'%</div>';
                  },
                  threshold: 0.1 
                }
              }
            },
            //grid: { hoverable: true, clickable: true },
            legend: { show: params.legend }
          });
        //elem.show();
      }
    }
  };
})
.directive('stackedquery', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Specify defaults for ALL directives
      var _d = {
        queries : ["*"],
        interval: secondsToHms(calculate_interval(scope.from,scope.to,40,0)/1000),
        colors  : ["#BF3030","#1D7373","#86B32D","#A98A21","#411F73"],
        show    : ['bars']
      }

      // Set ready flag and fill parameters (REQUIRED IN EVERY PANEL)
      scope.$watch(function () {
        return (attrs.params && scope.index) ? true : false;
      }, function (ready) {
        scope.ready = ready;
        if(ready) {
          scope.params = JSON.parse(attrs.params);
          _.each(_d, function(v, k) {
            scope.params[k] = _.isUndefined(scope.params[k]) 
              ? _d[k] : scope.params[k];
          });
        }
      });

      // Also get the data if time frame changes.
      // (REQUIRED IN EVERY PANEL)
      scope.$watch(function() { 
        return angular.toJson([scope.from, scope.to, scope.ready]) 
      }, function(){
        if(scope.ready)
          if (_.isUndefined(attrs.params.interval))
            scope.params.interval = secondsToHms(
              calculate_interval(scope.from,scope.to,50,0)/1000),
          get_data(scope,elem,attrs);
      });

      // Re-rending the panel if it is resized,
      scope.$watch('data', function() {
          render_panel(scope,elem,attrs);
      });

      // Or if the model changes
      angular.element(window).bind('resize', function(){
          render_panel(scope,elem,attrs);
      });

      // Function for getting data
      function get_data(scope,elem,attrs) {
        var params = scope.params;
        var ejs = scope.ejs;
        var request = ejs.Request().indices(scope.index);
        
        // Build the question part of the query
        var queries = [];
        _.each(params.queries, function(v) {
          queries.push(ejs.FilteredQuery(
            ejs.QueryStringQuery(v || '*'),
            ejs.RangeFilter(config.timefield)
              .from(scope.from)
              .to(scope.to)
              .cache(false))
          )
        });

        // Build the facet part
        _.each(queries, function(v) {
          request = request
            .facet(ejs.DateHistogramFacet(_.indexOf(queries,v))
              .field(config.timefield)
              .interval(params.interval)
              .facetFilter(ejs.QueryFilter(v))
            )
        })

        // Then run it
        var results = request.doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          scope.hits = results.hits.total;
          scope.data = results.facets;
        });
      }

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Parse our params object
        var params = scope.params;

        // Determine format
        var show = _.isUndefined(params.show) ? {
            bars: true, lines: false, points: false, fill: false
          } : {
            lines:  _.indexOf(params.show,'lines') < 0 ? false : true,
            bars:   _.indexOf(params.show,'bars') < 0 ? false : true,
            points: _.indexOf(params.show,'points') < 0 ? false : true,
            fill:   _.indexOf(params.show,'fill') < 0 ? false : true
          }

        scope.graph = [];
        // Push null values at beginning and end of timeframe
        _.each(scope.data, function(v, k) {
          var series = {};
          var data = [[scope.from.getTime(), null]];
          _.each(v.entries, function(v, k) {
            data.push([v['time'],v['count']])
          });
          data.push([scope.to.getTime(), null])
          series.data = {
            label: params.queries[k], 
            data: data, 
            color: params.colors[k%params.colors.length]
          };
          scope.graph.push(series.data)
        });

        // Set barwidth based on specified interval
        var barwidth = interval_to_seconds(params.interval)*1000

        // Populate element
        $.plot(elem, scope.graph, {
          legend: { 
            position: "nw", 
            labelFormatter: function(label, series) {
              return '<span class="legend">' + label + ' / ' + params.interval 
                + '</span>';
            }
          },
          series: {
            stack:  0,
            lines:  { show: show.lines, fill: show.fill },
            bars:   { show: show.bars,  fill: 1, barWidth: barwidth/1.8 },
            points: { show: show.points },
            color: params.color,
            shadowSize: 1
          },
          yaxis: { min: 0, color: "#000" },
          xaxis: {
            mode: "time",
            timeformat: "%H:%M:%S<br>%m-%d",
            label: "Datetime",
            color: "#000",
          },
          grid: {
            backgroundColor: '#fff',
            borderWidth: 0,
            borderColor: '#eee',
            color: "#eee",
            hoverable: true,
          }
        });
        //elem.show();
      }
    }
  };
})
.directive('map', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Specify defaults for ALL directives
      var _d = {
        queries : ["*"],
        interval: secondsToHms(calculate_interval(scope.from,scope.to,40,0)/1000),
        colors  : ["#BF3030","#1D7373","#86B32D","#A98A21","#411F73"],
        show    : ['bars'],
        size    : 100,
        exclude : []
      }

      // Set ready flag and fill parameters (REQUIRED IN EVERY PANEL)
      scope.$watch(function () {
        return (attrs.params && scope.index) ? true : false;
      }, function (ready) {
        scope.ready = ready;
        if(ready) {
          scope.params = JSON.parse(attrs.params);
          _.each(_d, function(v, k) {
            scope.params[k] = _.isUndefined(scope.params[k]) 
              ? _d[k] : scope.params[k];
          });
        }
      });

      // Also get the data if time frame changes.
      // (REQUIRED IN EVERY PANEL)
      scope.$watch(function() { 
        return angular.toJson([scope.from, scope.to, scope.ready]) 
      }, function(){
        if(scope.ready)
          if (_.isUndefined(attrs.params.interval))
            scope.params.interval = secondsToHms(
              calculate_interval(scope.from,scope.to,50,0)/1000),
          get_data(scope,elem,attrs);
      });

      // Re-rending the panel if it is resized,
      scope.$watch('data', function() {
          render_panel(scope,elem,attrs);
      });

      // Or if the model changes
      angular.element(window).bind('resize', function(){
          render_panel(scope,elem,attrs);
      });

      // Function for getting data
      function get_data(scope,elem,attrs) {
        var params = scope.params;
        var ejs = scope.ejs;
        var request = ejs.Request().indices(scope.index);
        
        // Build the question part of the query
        var query = ejs.FilteredQuery(
          ejs.QueryStringQuery(params.query || '*'),
          ejs.RangeFilter(config.timefield)
            .from(scope.from)
            .to(scope.to)
            .cache(false)
          );

        // Then the insert into facet and make the request
        var results = request
          .facet(ejs.TermsFacet('worldmap')
            .field(params.field)
            .size(params['size'])
            .exclude(params.exclude)
            .facetFilter(ejs.QueryFilter(query))
          )
          .doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          scope.hits = results.hits.total;
          scope.data = results.facets.worldmap.terms;
        });
      }

      // Function for rendering panel
      function render_panel(scope,elem,attrs) {
        // Parse our params object
        var params = scope.params;

        // Determine format
        var show = _.isUndefined(params.show) ? {
            bars: true, lines: false, points: false, fill: false
          } : {
            lines:  _.indexOf(params.show,'lines') < 0 ? false : true,
            bars:   _.indexOf(params.show,'bars') < 0 ? false : true,
            points: _.indexOf(params.show,'points') < 0 ? false : true,
            fill:   _.indexOf(params.show,'fill') < 0 ? false : true
          }

        scope.graph = [];
        // Push null values at beginning and end of timeframe
        _.each(scope.data, function(v, k) {
          var series = {};
          var data = [[scope.from.getTime(), null]];
          _.each(v.entries, function(v, k) {
            data.push([v['time'],v['count']])
          });
          data.push([scope.to.getTime(), null])
          series.data = {
            label: params.queries[k], 
            data: data, 
            color: params.colors[k%params.colors.length]
          };
          scope.graph.push(series.data)
        });

        // Set barwidth based on specified interval
        var barwidth = interval_to_seconds(params.interval)*1000
        var values = {}
        _.each(scope.data, function(v) {
          values[v.term.toUpperCase()] = v.count;
        });
        console.log(values)

        // Populate element
        $('.jvectormap-label,.jvectormap-zoomin,.jvectormap-zoomout').remove();
        elem.text('');
        elem.vectorMap({  
          map: 'world_mill_en',
          regionStyle: {initial: {fill: '#eee'}},
          zoomOnScroll: false,
          backgroundColor: '#fff',
          series: {
            regions: [{
              values: values,
              scale: ['#C8EEFF', '#0071A4'],
              normalizeFunction: 'polynomial'
            }]
          }
        });
        //elem.show();
      }
    }
  };
});
