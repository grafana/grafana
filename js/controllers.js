/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.controllers', [])
.controller('DashCtrl', function($scope, $rootScope, ejsResource, timer) {

  $scope.config = config;
  $scope._ = _;


  if (Modernizr.localstorage && 
    !(_.isUndefined(localStorage['dashboard'])) &&
    localStorage['dashboard'] !== ''
  ) {
    $scope.dashboards = JSON.parse(localStorage['dashboard']);
  } else {
    $scope.dashboards = dashboards;
  }

  var ejs = $scope.ejs = ejsResource(config.elasticsearch);  

  $scope.export = function() {
    var blob = new Blob([angular.toJson($scope.dashboards)], {type: "application/json;charset=utf-8"});
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

})
.controller('RowCtrl', function($scope, $rootScope, $timeout, ejsResource, timer) {

  $scope.toggle_row = function(row) {
    row.collapse = row.collapse ? false : true;
    if (!row.collapse) {
      $timeout(function() {
        $scope.$broadcast('render')
      });
    }
  }

});



























