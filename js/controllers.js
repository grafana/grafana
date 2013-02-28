/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.controllers', [])
.controller('DashCtrl', function($scope, $rootScope, $http, $timeout, ejsResource, eventBus) {

  var _d = {
    title: "",
    editable: true,
    rows: [],
  }

  $scope.init = function() {

    $scope.config = config;
    $scope._ = _;
    $scope.reset_row();
    $scope.clear_all_alerts();

    // Load dashboard by event 
    eventBus.register($scope,'dashboard', function(event,dashboard){
      console.log(dashboard)
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

  $scope.init();

})
.controller('RowCtrl', function($scope, $rootScope, $timeout, ejsResource) {

  var _d = {
    title: "Row",
    height: "150px",
    collapse: false,
    editable: true,
    panels: [],
  }
  _.defaults($scope.row,_d)


  $scope.init = function(){
    $scope.reset_panel();
  }

  $scope.toggle_row = function(row) {
    row.collapse = row.collapse ? false : true;
    if (!row.collapse) {
      $timeout(function() {
        $scope.send_render();
      });
    }
  }

  $scope.send_render = function() {
    $scope.$broadcast('render');
  }

  $scope.add_panel = function(row,panel) {
    $scope.row.panels.push(panel);
  }

  $scope.reset_panel = function() {
    $scope.panel = {
      loading: false,
      error: false,
      span: 3,
      editable: true,
      group: ['default'],
    };
  };

  $scope.init();

});



























