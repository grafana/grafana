/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.controllers', [])
.controller('DashCtrl', function($scope, $rootScope, $http, $timeout, $route, ejsResource, 
  fields, dashboard) {

  var _d = {
    title: "",
    editable: true,
    rows: [],
    last: null,
    style: 'dark'
  };

  $scope.editor = {
    index: 0
  };

  $scope.init = function() {

    $scope.config = config;
    // Make underscore.js available to views
    $scope._ = _;
    $scope.dashboard = dashboard;

    // Provide a global list of all see fields
    $scope.fields = fields;
    $scope.reset_row();
    $scope.clear_all_alerts();

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

  $scope.alert = function(title,text,severity,timeout) {
    var alert = {
      title: title,
      text: text,
      severity: severity || 'info',
    };
    $scope.global_alert.push(alert);
    if (timeout > 0) {
      $timeout(function() {
        $scope.global_alert = _.without($scope.global_alert,alert);
      }, timeout);
    }
  };

  $scope.clear_alert = function(alert) {
    $scope.global_alert = _.without($scope.global_alert,alert);
  };

  $scope.clear_all_alerts = function() {
    $scope.global_alert = [];
  }; 

  $scope.edit_path = function(type) {
    if(type) {
      return 'panels/'+type+'/editor.html';
    } else {
      return false;
    }
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

  $scope.reset_panel = function() {

    $scope.panel = {
      error   : false,
      span    : 3,
      editable: true,
      group   : ['default']
    };
  };

  $scope.init();

});



























