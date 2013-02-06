angular.module('kibana.text', [])
.controller('text', function($scope, $rootScope) {

  var _id = _.uniqueId();

  // Set and populate defaults
  var _d = {
    group   : "default",
    content : "",
    style: {},
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
  }
  $scope.init();
})