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
    $scope.ready = false;
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
          scope.ready = true;
          var converter = new Showdown.converter();
          var text = scope.panel.content.replace(/&/g, '&amp;')
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;');
          var htmlText = converter.makeHtml(text);
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