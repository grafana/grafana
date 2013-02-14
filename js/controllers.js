/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.controllers', [])
.controller('DashCtrl', function($scope, $rootScope, $http, ejsResource, timer) {

  var _d = {
    title: "",
    editable: true,
    rows: [],
  }

  $scope.init = function() {
    $scope.config = config;
    $scope._ = _;
    $scope.reset_row();

    // The global dashboards object should be moved to an $http request for json
    if (Modernizr.localstorage && 
      !(_.isUndefined(localStorage['dashboard'])) &&
      localStorage['dashboard'] !== ''
    ) {
      $scope.dashboards = JSON.parse(localStorage['dashboard']);
    } else {
      $scope.dashboards = dashboards
    }
    _.defaults($scope.dashboards,_d)


    var ejs = $scope.ejs = ejsResource(config.elasticsearch);  
  }


  $scope.export = function() {
    var blob = new Blob([angular.toJson($scope.dashboards,true)], {type: "application/json;charset=utf-8"});
    saveAs(blob, $scope.dashboards.title+"-"+new Date().getTime());
  }

  $scope.default = function() {
    if (Modernizr.localstorage) {
      localStorage['dashboard'] = angular.toJson($scope.dashboards);
      alert($scope.dashboards.title + " has been set as your default dashboard")
    } else {
      alert("Sorry, your browser is too old for this functionality");
    }  
  }

  $scope.purge = function() {
    if (Modernizr.localstorage) {
      localStorage['dashboard'] = '';
      alert('Default dashboard cleared')
    } else {
      alert("Sorry, your browser is too old for this functionality");
    }  
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

  $scope.init();


})
.controller('RowCtrl', function($scope, $rootScope, $timeout, ejsResource, timer) {

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
        $scope.$broadcast('render')
      });
    }
  }

  $scope.send_render = function() {
    $scope.$broadcast('render');
  }

  $scope.add_panel = function(row,panel) {
    console.log(panel)
    $scope.row.panels.push(panel);
  }

  $scope.reset_panel = function() {
    $scope.panel = {
      span: 1,
      editable: true,
      groups: ['default'],
    };
  };

  $scope.init();

});



























