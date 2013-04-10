/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.controllers', [])
.controller('DashCtrl', function($scope, $rootScope, $http, $timeout, ejsResource, eventBus, fields) {

  var _d = {
    title: "",
    editable: true,
    rows: [],
  }

  $scope.init = function() {

    $scope.config = config;
    // Make underscore.js available to views
    $scope._ = _;

    // Provide a global list of all see fields
    $scope.fields = fields
    $scope.reset_row();
    $scope.clear_all_alerts();

    // Load dashboard by event 
    eventBus.register($scope,'dashboard', function(event,dashboard){
      $scope.dashboards = dashboard;
      _.defaults($scope.dashboards,_d)
    })

    // If the route changes, clear the existing dashboard
    $rootScope.$on( "$routeChangeStart", function(event, next, current) {
      delete $scope.dashboards
    });

    var ejs = $scope.ejs = ejsResource(config.elasticsearch);  
  }

  $scope.add_row = function(dashboards,row) {
    $scope.dashboards.rows.push(row);
  }

  $scope.reset_row = function() {
    $scope.row = {
      title: '',
      height: '150px',
      editable: true,
    };
  };

  $scope.row_style = function(row) {
    return { 'min-height': row.collapse ? '5px' : row.height }
  }

  $scope.alert = function(title,text,severity,timeout) {
    var alert = {
      title: title,
      text: text,
      severity: severity || 'info',
    };
    $scope.global_alert.push(alert);
    if (timeout > 0)
      $timeout(function() {
        $scope.global_alert = _.without($scope.global_alert,alert)
      }, timeout);
  }

  $scope.clear_alert = function(alert) {
    $scope.global_alert = _.without($scope.global_alert,alert);
  }

  $scope.clear_all_alerts = function() {
    $scope.global_alert = []
  }  

  $scope.edit_path = function(type) {
    if(type)
      return 'panels/'+type+'/editor.html';
  }

  // This is whoafully incomplete, but will do for now 
  $scope.parse_error = function(data) {
    var _error = data.match("nested: (.*?);")
    return _.isNull(_error) ? data : _error[1];
  }

  $scope.init();

})
.controller('RowCtrl', function($scope, $rootScope, $timeout, ejsResource) {

  var _d = {
    title: "Row",
    height: "150px",
    collapse: false,
    collapsable: true,
    editable: true,
    panels: [],
  }
  _.defaults($scope.row,_d)


  $scope.init = function() {
    $scope.reset_panel();
  }

  $scope.toggle_row = function(row) {
    row.collapse = row.collapse ? false : true;
    if (!row.collapse) {
      $timeout(function() {
        $scope.$broadcast('render')
      });
    }
  }

  // This can be overridden by individual panel
  $scope.close_edit = function() {
    $scope.$broadcast('render')
  }

  $scope.add_panel = function(row,panel) {
    $scope.row.panels.push(panel);
  }

  $scope.reset_panel = function() {
    $scope.panel = {
      loading : false,
      error   : false,
      span    : 3,
      editable: true,
      group   : ['default'],
    };
  };

  $scope.init();

});



























