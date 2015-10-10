define([
  'angular',
  'lodash',
  'kbn',
  './directives',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('PostgresDatasource', function(backendSrv) {
    console.log("pg args", arguments);

    function PostgresDatasource(datasource) {
      console.log("pg init args", arguments);
      this.type = datasource.type;
      this.url = datasource.url;
      this.name = datasource.name;

      //this.supportAnnotations = true;
      this.supportMetrics = true;
    }

    PostgresDatasource.prototype.query = function(options) {
      console.log("pg query options", options);
      return backendSrv.datasourceRequest({
        method: 'POST',
        url: this.url + '/query',
        data: {
          range: {
            from: options.range.from.unix() * 1000,
            to: options.range.to.unix() * 1000,
          },
          maxDataPoints: options.maxDataPoints,
          interval: options.interval,
          targets: options.targets,
        },
      }).then(function(resp) {
        console.log("pg query response", resp);
        return resp.data;
      });
    };

    return PostgresDatasource;

  });

});
