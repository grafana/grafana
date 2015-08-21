define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('annotationsQueryEditorElasticsearch', function() {
    return {templateUrl: 'app/plugins/datasource/elasticsearch/partials/annotations.editor.html'};
  });

});
