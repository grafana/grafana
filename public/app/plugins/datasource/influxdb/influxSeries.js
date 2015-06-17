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

    if (self.series.length === 0) {
      return output;
    }

    var field_datapoints = function(datapoints, column_index) {
      return _.map(datapoints, function(datapoint) {
        return [datapoint[column_index - 1], _.last(datapoint)];
      });
    };

    _.each(self.series, function(series) {
      var datapoints = [];
      var columns = series.columns.length;
      for (var i = 0; i < series.values.length; i++) {
        datapoints[i] = series.values[i].slice(1);
        datapoints[i].push(new Date(series.values[i][0]).getTime());
      }

      for (var j = 1; j < columns; j++) {
        var seriesName = series.name;
        var columnName = series.columns[j];

        if (self.alias) {
          seriesName = self._getSeriesName(series);
        } else if (series.tags) {
          var tags = _.map(series.tags, function(value, key) {
            return key + ': ' + value;
          });
          if (columnName === 'value') {
            seriesName = seriesName + ' {' + tags.join(', ') + '}';
          } else {
            seriesName = seriesName + '.' + columnName + ' {' + tags.join(', ') + '}';
          }
        }

        output.push({ target: seriesName, datapoints: field_datapoints(datapoints, j)});
      }
    });

    return output;
  };

  p._getSeriesName = function(series) {
    var regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;

    return this.alias.replace(regex, function(match, g1, g2) {
      var group = g1 || g2;

      if (group === 'm' || group === 'measurement') { return series.name; }
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

  p.createNameForSeries = function(seriesName, groupByColValue) {
    var regex = /\$(\w+)/g;
    var segments = seriesName.split('.');

    return this.alias.replace(regex, function(match, group) {
      if (group === 's') {
        return seriesName;
      }
      else if (group === 'g') {
        return groupByColValue;
      }
      var index = parseInt(group);
      if (_.isNumber(index) && index < segments.length) {
        return segments[index];
      }
      return match;
    });

  };

  return InfluxSeries;
});
