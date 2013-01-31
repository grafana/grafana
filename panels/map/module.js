angular.module('kibana.map', [])
.controller('map', function($scope, $location) {

  // Set and populate defaults
  var _d = {
    query   : "*",
    map     : "world",
    colors  : ['#C8EEFF', '#0071A4'],
    size    : 100,
    exclude : []
  }
  _.each(_d, function(v, k) {
    $scope.panel[k] = _.isUndefined($scope.panel[k]) 
      ? _d[k] : $scope.panel[k];
  });


  if (!(_.isUndefined($scope.panel.group))) {
    $scope.$on($scope.panel.group+"-query", function(event, query) {
      $scope.panel.query = query;
      $scope.get_data();
    });
  }

  $scope.get_data = function() {
    var request = $scope.ejs.Request().indices($scope.index);

    // Then the insert into facet and make the request
    var results = request
      .facet(ejs.TermsFacet('map')
        .field($scope.panel.field)
        .size($scope.panel['size'])
        .exclude($scope.panel.exclude)
        .facetFilter(ejs.QueryFilter(
          ejs.FilteredQuery(
            ejs.QueryStringQuery($scope.panel.query || '*'),
            ejs.RangeFilter(config.timefield)
              .from($scope.from)
              .to($scope.to)
              .cache(false)
            )))).size(0)
      .doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.hits = results.hits.total;
      $scope.data = {};
      _.each(results.facets.map.terms, function(v) {
        $scope.data[v.term.toUpperCase()] = v.count;
      });
    });
  }

  $scope.$watch(function() { 
    return angular.toJson([$scope.from, $scope.to]) 
  }, function(){
    $scope.get_data();
  });

})
.directive('map', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      // Re-rending panel if data changes
      scope.$watch('data', function() {
        render_panel(scope,elem,attrs);
      });

      // Or if the window is resized
      angular.element(window).bind('resize', function(){
          render_panel(scope,elem,attrs);
      });

      function render_panel(scope,elem,attrs) {

        // Using LABjs, wait until all scripts are loaded before rendering panel
        var scripts = $LAB.script("common/lib/panels/jquery.jvectormap.min.js")
          .script("common/lib/panels/map."+scope.panel.map+".js")
                    
        // Populate element. Note that jvectormap appends, does not replace.
        scripts.wait(function(){
          elem.text('');
          $('.jvectormap-zoomin,.jvectormap-zoomout,.jvectormap-label').remove();
          var map = elem.vectorMap({  
            map: scope.panel.map,
            regionStyle: {initial: {fill: '#ddd'}},
            zoomOnScroll: false,
            backgroundColor: '#fff',
            series: {
              regions: [{
                values: scope.data,
                scale: scope.panel.colors,
                normalizeFunction: 'polynomial'
              }]
            },
            onRegionLabelShow: function(event, label, code){
              $('.jvectormap-label').css({
                "position"    : "absolute",
                "display"     : "none",
                "border"      : "solid 1px #CDCDCD",
                "background"  : "#292929",
                "color"       : "white",
                "font-family" : "sans-serif, Verdana",
                "font-size"   : "smaller",
                "padding"     : "3px"
              })
              var count = _.isUndefined(scope.data[code]) ? 0 : scope.data[code];
              $('.jvectormap-label').text(label.text() + ": " + count);
            },
            onRegionOut: function(event, code) {
            }
          });
        })
      }
    }
  };
});