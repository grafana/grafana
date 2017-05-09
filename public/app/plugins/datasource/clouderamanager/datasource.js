define([
  'angular',
  'lodash',
  'jquery',
  'config',
  'app/core/utils/datemath',
  'moment',
  './directives',
  './query_ctrl',
],
function (angular, _, $, config, dateMath, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ClouderaManagerDatasource', function($q, backendSrv) {
    function ClouderaManagerDatasource(datasource) {
      this.url = datasource.url;
      if (this.url.endsWith('/')) {
        this.url = this.url.substr(0, this.url.length - 1);
      }
      this.basicAuth = datasource.basicAuth;
      this.withCredentials = datasource.withCredentials;
      this.name = datasource.name;
    }

    // Helper to make API requests to Cloudera Manager. To avoid CORS issues, the requests may be proxied
    // through Grafana's backend via `backendSrv.datasourceRequest`.
    ClouderaManagerDatasource.prototype._request = function(options) {
      options.url = this.url + options.url;
      options.method = options.method || 'GET';
      options.inspect = { 'type': 'cloudera_manager' };

      if (this.basicAuth) {
        options.withCredentials = true;
        options.headers = {
          "Authorization": this.basicAuth
        };
      }

      return backendSrv.datasourceRequest(options);
    };

    // Test the connection to Cloudera Manager by querying for the supported API version.
    ClouderaManagerDatasource.prototype.testDatasource = function() {
      var options = {
        url: '/api/version',
        transformResponse: function(data) {
          return data;
        }
      };

      return this._request(options).then(function(response) {
        return {
          status: "success",
          message: "Data source is working. API version is '" + response.data + "'.",
          title: "Success"
        };
      });
    };

    // Query for metric targets within the specified time range.
    // Returns the promise of a result dictionary. See the convertResponse comment
    // for specifics of the result dictionary.
    ClouderaManagerDatasource.prototype.query = function(queryOptions) {
      var self = this;

      var targetPromises = _(queryOptions.targets)
        .filter(function(target) { return target.target && !target.hide; })
        .map(function(target) {
          var requestOptions = {
            url: '/api/v10/timeseries',
            params: {
              query: target.target,
              from: queryOptions.range.from.toJSON(),
              to: queryOptions.range.to.toJSON(),
              contentType: 'application/json',
            }
          };
          return self._request(requestOptions).then(self.convertResponse);
        })
        .value();

      return $q.all(targetPromises).then(function(convertedResponses) {
        var result = {
          data: _.map(convertedResponses, function(convertedResponse) {
            return convertedResponse.data;
          })
        };
        result.data = _.flatten(result.data);
        return result;
      });
    };

    // Convert the Cloudera Manager response to the format expected by Grafana.
    //
    // Grafana generally expects:
    // { data: [
    //   { target: 'metricName1',
    //     datapoints: [ [a1, ts-a1], [a2, ts-a2], [a3, ts-a3] ]
    //   },
    //   { target: 'metricName2',
    //     datapoints: [ [b1, ts-b1], [b2, ts-b2], [c3, ts-b3] ]
    //   },
    // ]}
    //
    // The CM API response has the general form:
    // items: {
    //   timeSeries: [
    //     {
    //       metadata: {
    //         metricName: "metricName1",
    //       },
    //       timeSeries: {
    //         value: 45.1234,
    //         timestamp: "2015-10-02T12:58:24.009Z",
    //       }
    //     }
    //   ]
    // }
    ClouderaManagerDatasource.prototype.convertResponse = function(response) {
      if (!response || !response.data || !response.data.items) { return []; }

      var seriesList = [];
      _(response.data.items).forEach(function(item) {
        _.forEach(item.timeSeries, function(timeSeries) {
          seriesList.push({
            target: timeSeries.metadata.metricName,
            datapoints: _.map(timeSeries.data, function(point) {
              var ts = moment.utc(dateMath.parse(point.timestamp)).unix() * 1000;
              return [point.value, ts];
            })
          });
        });
      });

      return {data: seriesList};
    };

    return ClouderaManagerDatasource;
  });
});
