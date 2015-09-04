define([
  'lodash',
],
function (_) {
  'use strict';

  function InfluxSeries(options) {
    this.series = options.series;
    this.alias = options.alias;
    this.annotation = options.annotation;
  }

  var p = InfluxSeries.prototype;

  p.getTimeSeries = function() {
    var output = [];
    var self = this;
    var i, j;

    if (self.series.length === 0) {
      return output;
    }

    _.each(self.series, function(series) {
      var columns = series.columns.length;
      var tags = _.map(series.tags, function(value, key) {
        return key + ': ' + value;
      });

      for (j = 1; j < columns; j++) {
        var seriesName = series.name;
        var columnName = series.columns[j];
        if (columnName !== 'value') {
          seriesName = seriesName + '.' + columnName;
        }

        if (self.alias) {
          seriesName = self._getSeriesName(series, j);
        } else if (series.tags) {
          seriesName = seriesName + ' {' + tags.join(', ') + '}';
        }

        var datapoints = [];
        if (series.values) {
          for (i = 0; i < series.values.length; i++) {
            datapoints[i] = [series.values[i][j], series.values[i][0]];
          }
        }

        output.push({ target: seriesName, datapoints: datapoints});
      }
    });

    return output;
  };

  p._getSeriesName = function(series, index) {
    var regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
    var segments = series.name.split('.');

    return this.alias.replace(regex, function(match, g1, g2) {
      var group = g1 || g2;
<<<<<<< a5d6ff308a8abf031604f8c4d746dc083d967405:public/app/plugins/datasource/influxdb/influx_series.js
<<<<<<< d104f4300a7fa4055bd18b83f31793eaf059416e:public/app/plugins/datasource/influxdb/influx_series.js
      var segIndex = parseInt(group, 10);
=======
      var segIndex = parseInt(group, 10)
>>>>>>> feat(influxdb): More alias options, can now use  syntax to reference part of a measurement name (seperated by dots), closes #2599:public/app/plugins/datasource/influxdb/influxSeries.js
=======
      var segIndex = parseInt(group, 10);
>>>>>>> fix(): fixed problems in last commit:public/app/plugins/datasource/influxdb/influxSeries.js

      if (group === 'm' || group === 'measurement') { return series.name; }
      if (group === 'col') { return series.columns[index]; }
      if (!isNaN(segIndex)) { return segments[segIndex]; }
      if (group.indexOf('tag_') !== 0) { return match; }

      var tag = group.replace('tag_', '');
      if (!series.tags) { return match; }
      return series.tags[tag];
    });
  };

  p.getAnnotations = function () {
    var list = [];
    var self = this;

    _.each(this.series, function (series) {
      var titleCol = null;
      var timeCol = null;
      var tagsCol = null;
      var textCol = null;

      _.each(series.columns, function(column, index) {
        if (column === 'time') { timeCol = index; return; }
        if (column === 'sequence_number') { return; }
        if (!titleCol) { titleCol = index; }
        if (column === self.annotation.titleColumn) { titleCol = index; return; }
        if (column === self.annotation.tagsColumn) { tagsCol = index; return; }
        if (column === self.annotation.textColumn) { textCol = index; return; }
      });

      _.each(series.values, function (value) {
        var data = {
          annotation: self.annotation,
          time: + new Date(value[timeCol]),
          title: value[titleCol],
          tags: value[tagsCol],
          text: value[textCol]
        };

        list.push(data);
      });
    });

    return list;
  };

  return InfluxSeries;
});
