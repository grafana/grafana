/*jshint globalstrict:true */
/*global angular:true */
/*

  ## Derivequeries

  Broadcasts an array of queries based on the results of a terms facet

  ### Parameters
  * label :: The label to stick over the field 
  * query :: A string to use as a filter for the terms facet
  * field :: the field to facet on
  * size :: how many queries to generate
  * fields :: a list of fields known to us
  * query_mode :: how to create query

*/

'use strict';

angular.module('kibana.derivequeries', [])
.controller('derivequeries', function($scope, $rootScope, query, fields, dashboard, filterSrv) {

  // Set and populate defaults
  var _d = {
    loading : false,
    status  : "Beta",
    label   : "Search",
    query   : "*",
    ids     : [],
    group   : "default",
    field   : '_type',
    fields  : [],
    spyable : true,
    size    : 5,
    mode    : 'terms only',
    exclude : [],
    history : [],
    remember: 10 // max: 100, angular strap can't take a variable for items param
  };
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.panel.fields = fields.list;
  };

  $scope.get_data = function() {
    update_history($scope.panel.query);
    
    // Make sure we have everything for the request to complete
    if(dashboard.indices.length === 0) {
      return;
    }

    $scope.panel.loading = true;
    var request = $scope.ejs.Request().indices(dashboard.indices);

    // Terms mode
    request = request
      .facet($scope.ejs.TermsFacet('query')
        .field($scope.panel.field)
        .size($scope.panel.size)
        .exclude($scope.panel.exclude)
        .facetFilter($scope.ejs.QueryFilter(
          $scope.ejs.FilteredQuery(
            $scope.ejs.QueryStringQuery($scope.panel.query || '*'),
            filterSrv.getBoolFilter(filterSrv.ids)
            )))).size(0);

    $scope.populate_modal(request);

    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.panel.loading = false;
      var suffix,
          data = [];
      if ($scope.panel.query === '' || $scope.panel.mode === 'terms only') {
        suffix = '';
      } else if ($scope.panel.mode === 'AND') {
        suffix = ' AND (' + $scope.panel.query + ')';
      } else if ($scope.panel.mode === 'OR') {
        suffix = ' OR (' + $scope.panel.query + ')';
      }
      var ids = [];
      _.each(results.facets.query.terms, function(v) {
        var _q = $scope.panel.field+':"'+v.term+'"'+suffix;
        // if it isn't in the list, remove it
        var _iq = query.findQuery(_q);
        if(!_iq) {
          ids.push(query.set({query:_q}));
        } else {
          ids.push(_iq.id);
        }
      });
      _.each(_.difference($scope.panel.ids,ids),function(id){
        query.remove(id);
      });
      $scope.panel.ids = ids;
      dashboard.refresh();
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
  };

  $scope.populate_modal = function(request) {
    $scope.modal = {
      title: "Inspector",
      body : "<h5>Last Elasticsearch Query</h5><pre>"+
          'curl -XGET '+config.elasticsearch+'/'+dashboard.indices+"/_search?pretty -d'\n"+
          angular.toJson(JSON.parse(request.toString()),true)+
        "'</pre>", 
    }; 
  };

  var update_history = function(query) {
    query = _.isArray(query) ? query : [query];
    if($scope.panel.remember > 0) {
      $scope.panel.history = _.union(query.reverse(),$scope.panel.history);
      var _length = $scope.panel.history.length;
      if(_length > $scope.panel.remember) {
        $scope.panel.history = $scope.panel.history.slice(0,$scope.panel.remember);
      }
    }
  };

});
