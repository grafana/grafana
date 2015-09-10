define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('zabbixHelperSrv', function($q) {
    var self = this;

    /**
     * Convert Zabbix API history.get response to Grafana format
     *
     * @param  {Array} items      Array of Zabbix Items
     * @param  {Array} history    Array of Zabbix History
     *
     * @return {Array}            Array of timeseries in Grafana format
     *                            {
     *                               target: "Metric name",
     *                               datapoints: [[<value>, <unixtime>], ...]
     *                            }
     */
    this.handleHistoryResponse = function(items, alias, scale, history) {
      /**
       * Response should be in the format:
       * data: [
       *          {
       *             target: "Metric name",
       *             datapoints: [[<value>, <unixtime>], ...]
       *          },
       *          {
       *             target: "Metric name",
       *             datapoints: [[<value>, <unixtime>], ...]
       *          },
       *       ]
       */

      // Group items and history by itemid
      var indexed_items = _.indexBy(items, 'itemid');
      var grouped_history = _.groupBy(history, 'itemid');

      var self = this;
      return $q.when(_.map(grouped_history, function (history, itemid) {
        var item = indexed_items[itemid];
        var series = {
          target: (item.hosts ? item.hosts[0].name+': ' : '')
            + (alias ? alias : self.expandItemName(item)),
          datapoints: _.map(history, function (p) {

            // Value must be a number for properly work
            var value = Number(p.value);

            // Apply scale
            if (scale) {
              value *= scale;
            }
            return [value, p.clock * 1000];
          })
        };
        return series;
      })).then(function (result) {
        return _.sortBy(result, 'target');
      });
    };

    /**
     * Convert Zabbix API trends.get response to Grafana format
     *
     * @param  {Array} items      Array of Zabbix Items
     * @param  {Array} trends     Array of Zabbix Trends
     *
     * @return {Array}            Array of timeseries in Grafana format
     *                            {
     *                               target: "Metric name",
     *                               datapoints: [[<value>, <unixtime>], ...]
     *                            }
     */
    this.handleTrendResponse = function (items, alias, scale, trends) {

      // Group items and trends by itemid
      var indexed_items = _.indexBy(items, 'itemid');
      var grouped_trends = _.groupBy(trends, 'itemid');

      var self = this;
      return $q.when(_.map(grouped_trends, function (trends, itemid) {
        var item = indexed_items[itemid];
        var series = {
          target: (item.hosts ? item.hosts[0].name+': ' : '')
            + (alias ? alias : self.expandItemName(item)),
          datapoints: _.map(trends, function (p) {

            // Value must be a number for properly work
            var value = Number(p.value_avg);

            // Apply scale
            if (scale) {
              value *= scale;
            }
            return [value, p.clock * 1000];
          })
        };
        return series;
      })).then(function (result) {
        return _.sortBy(result, 'target');
      });
    };

    /**
     * Expand item parameters, for example:
     * CPU $2 time ($3) --> CPU system time (avg1)
     *
     * @param item: zabbix api item object
     * @return: expanded item name (string)
     */
    this.expandItemName = function(item) {
      var name = item.name;
      var key = item.key_;

      // extract params from key:
      // "system.cpu.util[,system,avg1]" --> ["", "system", "avg1"]
      var key_params = key.substring(key.indexOf('[') + 1, key.lastIndexOf(']')).split(',');

      // replace item parameters
      for (var i = key_params.length; i >= 1; i--) {
        name = name.replace('$' + i, key_params[i - 1]);
      }
      return name;
    };

    /**
     * Convert multiple mettrics to array
     * "{metric1,metcic2,...,metricN}" --> [metric1, metcic2,..., metricN]
     *
     * @param  {string} metrics   "{metric1,metcic2,...,metricN}"
     * @return {Array}            [metric1, metcic2,..., metricN]
     */
    this.splitMetrics = function(metrics) {
      var remove_brackets_pattern = /^{|}$/g;
      var metric_split_pattern = /,(?!\s)/g;
      return metrics.replace(remove_brackets_pattern, '').split(metric_split_pattern);
    };

    /**
     * Convert Date object to local time in format
     * YYYY-MM-DD HH:mm:ss
     *
     * @param  {Date} date Date object
     * @return {string} formatted local time YYYY-MM-DD HH:mm:ss
     */
    this.getShortTime = function(date) {
      var MM = date.getMonth() < 10 ? '0' + date.getMonth() : date.getMonth();
      var DD = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
      var HH = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
      var mm = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
      var ss = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();
      return date.getFullYear() + '-' + MM + '-' + DD + ' ' + HH + ':' + mm + ':' + ss;
    };

    /**
     * Format acknowledges.
     *
     * @param  {array} acknowledges array of Zabbix acknowledge objects
     * @return {string} HTML-formatted table
     */
    this.formatAcknowledges = function(acknowledges) {
      if (acknowledges.length) {
        var formatted_acknowledges = '<br><br>Acknowledges:<br><table><tr><td><b>Time</b></td>'
          + '<td><b>User</b></td><td><b>Comments</b></td></tr>';
        _.each(_.map(acknowledges, function (ack) {
          var time = new Date(ack.clock * 1000);
          return '<tr><td><i>' + self.getShortTime(time) + '</i></td><td>' + ack.alias
            + ' (' + ack.name + ' ' + ack.surname + ')' + '</td><td>' + ack.message + '</td></tr>';
        }), function (ack) {
          formatted_acknowledges = formatted_acknowledges.concat(ack);
        });
        formatted_acknowledges = formatted_acknowledges.concat('</table>');
        return formatted_acknowledges;
      } else {
        return '';
      }
    };

    /**
     * Downsample datapoints series
     *
     * @param   {array}     datapoints        [[<value>, <unixtime>], ...]
     * @param   {integer}   time_to           Panel time to
     * @param   {integer}   ms_interval       Interval in milliseconds for grouping datapoints
     * @return  {array}     [[<value>, <unixtime>], ...]
     */
    this.downsampleSeries = function(datapoints, time_to, ms_interval) {
      var downsampledSeries = [];
      var timeWindow = {
        from: time_to * 1000 - ms_interval,
        to: time_to * 1000
      };

      var points_sum = 0;
      var points_num = 0;
      var value_avg = 0;
      for (var i = datapoints.length - 1; i >= 0; i -= 1) {
        if (timeWindow.from < datapoints[i][1] && datapoints[i][1] <= timeWindow.to) {
          points_sum += datapoints[i][0];
          points_num++;
        }
        else {
          value_avg = points_num ? points_sum / points_num : 0;
          downsampledSeries.push([value_avg, timeWindow.to]);

          // Shift time window
          timeWindow.to = timeWindow.from;
          timeWindow.from -= ms_interval;

          points_sum = 0;
          points_num = 0;

          // Process point again
          i++;
        }
      }
      return downsampledSeries.reverse();
    };
  });
});