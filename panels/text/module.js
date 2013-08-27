/*jshint globalstrict:true */
/*global angular:true */
/*global Showdown:false */
/*

  ## Text

  ### Parameters
  * mode :: 'text', 'html', 'markdown'
  * content :: Content of the panel
  * style :: Hash containing css properties

*/

'use strict';

angular.module('kibana.text', [])
.controller('text', function($scope, $rootScope) {

  $scope.panelMeta = {
    status  : "Stable",
    description : "A static text panel that can use plain text, markdown, or (sanitized) HTML"
  };


  // Set and populate defaults
  var _d = {
    status  : "Stable",
    mode    : "markdown",
    content : "",
    style: {},
  };
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    $scope.ready = false;
  };

}).directive('markdown', function() {
  return {
    restrict: 'E',
    link: function(scope, element, attrs) {
      scope.$on('render', function() {
        render_panel();
      });

      function render_panel() {
        var scripts = $LAB.script("panels/text/lib/showdown.js");
        scripts.wait(function(){
          scope.ready = true;
          var converter = new Showdown.converter();
          var text = scope.panel.content.replace(/&/g, '&amp;')
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;');
          var htmlText = converter.makeHtml(text);
          element.html(htmlText);
          // For whatever reason, this fixes chrome. I don't like it, I think
          // it makes things slow?
          if(!scope.$$phase) {
            scope.$apply();
          }
        });
      }

      render_panel();
    }
  };
})
.filter('newlines', function(){
  return function (input) {
    return input.replace(/\n/g, '<br/>');
  };
})
.filter('striphtml', function () {
  return function(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/>/g, '&gt;')
      .replace(/</g, '&lt;');
  };
});