/*jshint globalstrict:true */
/*global angular:true */
/*

  ## Table

  ### Parameters
  * size :: Number of events per page to show
  * pages :: Number of pages to show. size * pages = number of cached events.
             Bigger = more memory usage byh the browser
  * offset :: Position from which to start in the array of hits
  * sort :: An array with 2 elements. sort[0]: field, sort[1]: direction ('asc' or 'desc')
  * style :: hash of css properties
  * fields :: columns to show in table
  * overflow :: 'height' or 'min-height' controls wether the row will expand (min-height) to
                to fit the table, or if the table will scroll to fit the row (height)
  * trimFactor :: If line is > this many characters, divided by the number of columns, trim it.
  * sortable :: Allow sorting?
  * spyable :: Show the 'eye' icon that reveals the last ES query for this panel

*/

'use strict';

angular.module('kibana.table', [])
.controller('table', function($rootScope, $scope, fields, querySrv, dashboard, filterSrv) {

  $scope.panelMeta = {
    editorTabs : [
      {title:'Paging', src:'panels/table/pagination.html'},
      {title:'Queries', src:'partials/querySelect.html'}
    ],
    status: "Stable",
    description: "A paginated table of records matching your query or queries. Click on a row to "+
      "expand it and review all of the fields associated with that document. <p>"
  };

  // Set and populate defaults
  var _d = {
    status  : "Stable",
    queries     : {
      mode        : 'all',
      ids         : []
    },
    size    : 100, // Per page
    pages   : 5,   // Pages available
    offset  : 0,
    sort    : ['@timestamp','desc'],
    group   : "default",
    style   : {'font-size': '9pt'},
    overflow: 'height',
    fields  : [],
    highlight : [],
    sortable: true,
    header  : true,
    paging  : true,
    field_list: true,
    trimFactor: 300,
    normTimes : true,
    spyable : true
  };
  _.defaults($scope.panel,_d);

  $scope.init = function () {
    $scope.Math = Math;

    $scope.$on('refresh',function(){$scope.get_data();});

    $scope.fields = fields;
    $scope.get_data();
  };

  $scope.percent = kbn.to_percent;

  $scope.toggle_micropanel = function(field) {
    var docs = _.pluck($scope.data,'_source');
    $scope.micropanel = {
      field: field,
      values : kbn.top_field_values(docs,field,10),
      related : kbn.get_related_fields(docs,field),
      count: _.countBy(docs,function(doc){return _.contains(_.keys(doc),field);})['true']
    };
  };

  $scope.micropanelColor = function(index) {
    var _c = ['bar-success','bar-warning','bar-danger','bar-info','bar-primary'];
    return index > _c.length ? '' : _c[index];
  };

  $scope.set_sort = function(field) {
    if($scope.panel.sort[0] === field) {
      $scope.panel.sort[1] = $scope.panel.sort[1] === 'asc' ? 'desc' : 'asc';
    } else {
      $scope.panel.sort[0] = field;
    }
    $scope.get_data();
  };

  $scope.toggle_field = function(field) {
    if (_.indexOf($scope.panel.fields,field) > -1) {
      $scope.panel.fields = _.without($scope.panel.fields,field);
    } else {
      $scope.panel.fields.push(field);
    }
  };

  $scope.toggle_highlight = function(field) {
    if (_.indexOf($scope.panel.highlight,field) > -1) {
      $scope.panel.highlight = _.without($scope.panel.highlight,field);
    } else {
      $scope.panel.highlight.push(field);
    }
  };

  $scope.toggle_details = function(row) {
    row.kibana = row.kibana || {};
    row.kibana.details = !row.kibana.details ? $scope.without_kibana(row) : false;
  };

  $scope.page = function(page) {
    $scope.panel.offset = page*$scope.panel.size;
    $scope.get_data();
  };

  $scope.build_search = function(field,value,negate) {
    var query;
    // This needs to be abstracted somewhere
    if(_.isArray(value)) {
      query = "(" + _.map(value,function(v){return angular.toJson(v);}).join(" AND ") + ")";
    } else if (_.isUndefined(value)) {
      query = '*';
      negate = !negate;
    } else {
      query = angular.toJson(value);
    }
    filterSrv.set({type:'field',field:field,query:query,mandate:(negate ? 'mustNot':'must')});
    $scope.panel.offset = 0;
    dashboard.refresh();
  };

  $scope.fieldExists = function(field,mandate) {
    filterSrv.set({type:'exists',field:field,mandate:mandate});
    dashboard.refresh();
  };

  $scope.get_data = function(segment,query_id) {
    $scope.panel.error =  false;

    // Make sure we have everything for the request to complete
    if(dashboard.indices.length === 0) {
      return;
    }

    $scope.panelMeta.loading = true;

    $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);

    var _segment = _.isUndefined(segment) ? 0 : segment;
    $scope.segment = _segment;

    var request = $scope.ejs.Request().indices(dashboard.indices[_segment]);

    var boolQuery = $scope.ejs.BoolQuery();
    _.each($scope.panel.queries.ids,function(id) {
      boolQuery = boolQuery.should(querySrv.getEjsObj(id));
    });

    request = request.query(
      $scope.ejs.FilteredQuery(
        boolQuery,
        filterSrv.getBoolFilter(filterSrv.ids)
      ))
      .highlight(
        $scope.ejs.Highlight($scope.panel.highlight)
        .fragmentSize(2147483647) // Max size of a 32bit unsigned int
        .preTags('@start-highlight@')
        .postTags('@end-highlight@')
      )
      .size($scope.panel.size*$scope.panel.pages)
      .sort($scope.panel.sort[0],$scope.panel.sort[1]);

    $scope.populate_modal(request);

    var results = request.doSearch();

    // Populate scope when we have results
    results.then(function(results) {
      $scope.panelMeta.loading = false;

      if(_segment === 0) {
        $scope.hits = 0;
        $scope.data = [];
        query_id = $scope.query_id = new Date().getTime();
      }

      // Check for error and abort if found
      if(!(_.isUndefined(results.error))) {
        $scope.panel.error = $scope.parse_error(results.error);
        return;
      }

      // Check that we're still on the same query, if not stop
      if($scope.query_id === query_id) {
        $scope.data= $scope.data.concat(_.map(results.hits.hits, function(hit) {
          return {
            _source   : kbn.flatten_json(hit._source),
            highlight : kbn.flatten_json(hit.highlight||{}),
            _type     : hit._type,
            _index    : hit._index,
            _id       : hit._id,
            _sort     : hit.sort
          };
        }));

        $scope.hits += results.hits.total;

        // Sort the data
        $scope.data = _.sortBy($scope.data, function(v){
          return v._sort[0];
        });

        // Reverse if needed
        if($scope.panel.sort[1] === 'desc') {
          $scope.data.reverse();
        }

        // Keep only what we need for the set
        $scope.data = $scope.data.slice(0,$scope.panel.size * $scope.panel.pages);

      } else {
        return;
      }

      // If we're not sorting in reverse chrono order, query every index for
      // size*pages results
      // Otherwise, only get size*pages results then stop querying
      if (($scope.data.length < $scope.panel.size*$scope.panel.pages ||
        !((_.contains(filterSrv.timeField(),$scope.panel.sort[0])) && $scope.panel.sort[1] === 'desc')) &&
        _segment+1 < dashboard.indices.length) {
        $scope.get_data(_segment+1,$scope.query_id);
      }

    });
  };

  $scope.populate_modal = function(request) {
    $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);
  };

  $scope.without_kibana = function (row) {
    return {
      _source   : row._source,
      highlight : row.highlight
    };
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


})
.filter('tableHighlight', function() {
  return function(text) {
    if (!_.isUndefined(text) && !_.isNull(text) && text.toString().length > 0) {
      return text.toString().
        replace(/&/g, '&amp;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;').
        replace(/\r?\n/g, '<br/>').
        replace(/@start-highlight@/g, '<code class="highlight">').
        replace(/@end-highlight@/g, '</code>');
    }
    return '';
  };
})
.filter('tableTruncate', function() {
  return function(text,length,factor) {
    if (!_.isUndefined(text) && !_.isNull(text) && text.toString().length > 0) {
      return text.length > length/factor ? text.substr(0,length/factor)+'...' : text;
    }
    return '';
  };
// WIP
}).filter('tableFieldFormat', function(fields){
  return function(text,field,event,scope) {
    var type;
    if(
      !_.isUndefined(fields.mapping[event._index]) &&
      !_.isUndefined(fields.mapping[event._index][event._type])
    ) {
      type = fields.mapping[event._index][event._type][field]['type'];
      if(type === 'date' && scope.panel.normTimes) {
        return moment(text).format('YYYY-MM-DD HH:mm:ss');
      }
    }
    return text;
  };
});
