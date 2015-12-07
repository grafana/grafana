define([
    'angular'
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('metricQueryEditorZabbix', function() {
      return {controller: 'ZabbixAPIQueryCtrl', templateUrl: 'app/plugins/datasource/zabbix/partials/query.editor.html'};
    });

    module.directive('metricQueryOptionsZabbix', function() {
      return {templateUrl: 'app/plugins/datasource/zabbix/partials/query.options.html'};
    });

  });
