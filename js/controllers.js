/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.controllers', [])
.controller('DashCtrl', function($scope, $rootScope, $http, $timeout, $route, ejsResource,
  fields, dashboard, alertSrv) {

  $scope.editor = {
    index: 0
  };

  $scope.init = function() {

    $scope.config = config;
    // Make underscore.js available to views
    $scope._ = _;
    $scope.dashboard = dashboard;
    $scope.dashAlerts = alertSrv;
    alertSrv.clearAll();

    // Provide a global list of all see fields
    $scope.fields = fields;
    $scope.reset_row();

    var ejs = $scope.ejs = ejsResource(config.elasticsearch);
  };

  $scope.add_row = function(dash,row) {
    dash.rows.push(row);
  };

  $scope.reset_row = function() {
    $scope.row = {
      title: '',
      height: '150px',
      editable: true,
    };
  };

  $scope.row_style = function(row) {
    return { 'min-height': row.collapse ? '5px' : row.height };
  };

  $scope.edit_path = function(type) {
    if(type) {
      return 'panels/'+type+'/editor.html';
    } else {
      return false;
    }
  };

  $scope.setEditorTabs = function(panelMeta) {
    $scope.editorTabs = ['General','Panel'];
    if(!_.isUndefined(panelMeta.editorTabs)) {
      $scope.editorTabs =  _.union($scope.editorTabs,_.pluck(panelMeta.editorTabs,'title'));
    }
    return $scope.editorTabs;
  };

  // This is whoafully incomplete, but will do for now
  $scope.parse_error = function(data) {
    var _error = data.match("nested: (.*?);");
    return _.isNull(_error) ? data : _error[1];
  };

  $scope.init();

})
.controller('RowCtrl', function($scope, $rootScope, $timeout, ejsResource, querySrv) {

  var _d = {
    title: "Row",
    height: "150px",
    collapse: false,
    collapsable: true,
    editable: true,
    panels: [],
  };

  _.defaults($scope.row,_d);


  $scope.init = function() {
    $scope.querySrv = querySrv;
    $scope.reset_panel();
  };

  $scope.toggle_row = function(row) {
    if(!row.collapsable) {
      return;
    }
    row.collapse = row.collapse ? false : true;
    if (!row.collapse) {
      $timeout(function() {
        $scope.$broadcast('render');
      });
    }
  };

  // This can be overridden by individual panels
  $scope.close_edit = function() {
    $scope.$broadcast('render');
  };

  $scope.add_panel = function(row,panel) {
    $scope.row.panels.push(panel);
  };

  $scope.reset_panel = function(type) {
    $scope.panel = {
      error   : false,
      span    : 3,
      editable: true,
      type    : type
    };
  };

  $scope.init();

})
.controller('dashLoader', function($scope, $http, timer, dashboard, alertSrv) {

  $scope.loader = dashboard.current.loader;

  $scope.init = function() {
    $scope.gist_pattern = /(^\d{5,}$)|(^[a-z0-9]{10,}$)|(gist.github.com(\/*.*)\/[a-z0-9]{5,}\/*$)/;
    $scope.gist = $scope.gist || {};
    $scope.elasticsearch = $scope.elasticsearch || {};
  };

  $scope.showDropdown = function(type) {
    var _l = $scope.loader;
    if(type === 'load') {
      return (_l.load_elasticsearch || _l.load_gist || _l.load_local);
    }
    if(type === 'save') {
      return (_l.save_elasticsearch || _l.save_gist || _l.local_local || _l.save_default);
    }
    if(type === 'share') {
      return (_l.save_temp);
    }
    return false;
  };

  $scope.set_default = function() {
    if(dashboard.set_default()) {
      alertSrv.set('Local Default Set',dashboard.current.title+' has been set as your local default','success',5000);
    } else {
      alertSrv.set('Incompatible Browser','Sorry, your browser is too old for this feature','error',5000);
    }
  };

  $scope.purge_default = function() {
    if(dashboard.purge_default()) {
      alertSrv.set('Local Default Clear','Your local default dashboard has been cleared','success',5000);
    } else {
      alertSrv.set('Incompatible Browser','Sorry, your browser is too old for this feature','error',5000);
    }
  };

  $scope.elasticsearch_save = function(type,ttl) {
    dashboard.elasticsearch_save(
      type,
      ($scope.elasticsearch.title || dashboard.current.title),
      ($scope.loader.save_temp_ttl_enable ? ttl : false)
    ).then(
      function(result) {
      if(!_.isUndefined(result._id)) {
        alertSrv.set('Dashboard Saved','This dashboard has been saved to Elasticsearch as "' +
          result._id + '"','success',5000);
        if(type === 'temp') {
          $scope.share = dashboard.share_link(dashboard.current.title,'temp',result._id);
        }
      } else {
        alertSrv.set('Save failed','Dashboard could not be saved to Elasticsearch','error',5000);
      }
    });
  };

  $scope.elasticsearch_delete = function(id) {
    dashboard.elasticsearch_delete(id).then(
      function(result) {
        if(!_.isUndefined(result)) {
          if(result.found) {
            alertSrv.set('Dashboard Deleted',id+' has been deleted','success',5000);
            // Find the deleted dashboard in the cached list and remove it
            var toDelete = _.where($scope.elasticsearch.dashboards,{_id:id})[0];
            $scope.elasticsearch.dashboards = _.without($scope.elasticsearch.dashboards,toDelete);
          } else {
            alertSrv.set('Dashboard Not Found','Could not find '+id+' in Elasticsearch','warning',5000);
          }
        } else {
          alertSrv.set('Dashboard Not Deleted','An error occurred deleting the dashboard','error',5000);
        }
      }
    );
  };

  $scope.elasticsearch_dblist = function(query) {
    dashboard.elasticsearch_list(query,$scope.loader.load_elasticsearch_size).then(
      function(result) {
      if(!_.isUndefined(result.hits)) {
        $scope.hits = result.hits.total;
        $scope.elasticsearch.dashboards = result.hits.hits;
      }
    });
  };

  $scope.save_gist = function() {
    dashboard.save_gist($scope.gist.title).then(
      function(link) {
      if(!_.isUndefined(link)) {
        $scope.gist.last = link;
        alertSrv.set('Gist saved','You will be able to access your exported dashboard file at '+
          '<a href="'+link+'">'+link+'</a> in a moment','success');
      } else {
        alertSrv.set('Save failed','Gist could not be saved','error',5000);
      }
    });
  };

  $scope.gist_dblist = function(id) {
    dashboard.gist_list(id).then(
      function(files) {
      if(files && files.length > 0) {
        $scope.gist.files = files;
      } else {
        alertSrv.set('Gist Failed','Could not retrieve dashboard list from gist','error',5000);
      }
    });
  };
});



























