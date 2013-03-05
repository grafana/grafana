angular.module('kibana.text', [])
.controller('text', function($scope, $rootScope) {

  // Set and populate defaults
  var _d = {
    group   : "default",
    content : "",
    style: {},
  }
  _.defaults($scope.panel,_d);

  $scope.init = function() {
  }

})
.filter('newlines', function(){
  return function (input) {
    return input.replace(/\n/g, '<br/>');
  }
})
.filter('striphtml', function () {
    return function(text) {
        return text
                .replace(/&/g, '&amp;')
                .replace(/>/g, '&gt;')
                .replace(/</g, '&lt;');
    }
});