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

});



























