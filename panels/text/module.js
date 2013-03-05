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

}).directive('markdown', function() {
  return {
    restrict: 'E',
    link: function(scope, element, attrs) {
      scope.$on('render', function() {
        render_panel();
      })

      function render_panel() {
        var scripts = $LAB.script("panels/text/lib/showdown.js")
        scripts.wait(function(){
          var converter = new Showdown.converter();
          var htmlText = converter.makeHtml(scope.panel.content);
          element.html(htmlText);
        });
      }

      render_panel();
    }
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