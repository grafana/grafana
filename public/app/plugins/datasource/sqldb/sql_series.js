define([
  'lodash',
  'app/core/table_model',
],
function (_, TableModel) {
  'use strict';

  function SqlSeries(options) {
    this.series = options.series;
    this.table = options.table;
    this.alias = options.alias;
    this.annotation = options.annotation;
  }

  var p = SqlSeries.prototype;

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
        var seriesName = self.table;
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
            var sample = Number(series.values[i][j]);
            var ts = parseFloat(series.values[i][0]);

            if (isNaN(sample)) {
              datapoints[i] = [series.values[i][j], ts];
            } else {
              datapoints[i] = [sample, ts];
            }
          }
        }

        output.push({ target: seriesName, datapoints: datapoints});
      }
    });

    return output;
  };

  p._getSeriesName = function(series, index) {
    var self = this;
    var regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;

    return this.alias.replace(regex, function(match, g1, g2) {
      var group = g1 || g2;

      if (group === 't' || group === 'table') { return self.table || series.name; }
      if (group === 'col') { return series.columns[index]; }

      return match;
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
        if (column === 'tags') { tagsCol = index; return; }
        if (column === 'title') { titleCol = index; return; }
        if (column === 'text') { textCol = index; return; }
        if (!titleCol) { titleCol = index; }
      });

      _.each(series.values, function (value) {
        var data = {
          annotation: self.annotation,
          time: + new Date(parseFloat(value[timeCol])),
          title: value[titleCol],
          tags: value[tagsCol],
          text: value[textCol]
        };

        list.push(data);
      });
    });

    return list;
  };

  p.getTable = function() {
    var table = new TableModel.default();
    var self = this;
    var i, j;

    if (self.series.length === 0) {
      return table;
    }

    _.each(self.series, function(series, seriesIndex) {

      if (seriesIndex === 0) {
        table.columns.push({text: 'Time', type: 'time'});
        _.each(_.keys(series.tags), function(key) {
          table.columns.push({text: key});
        });
        for (j = 1; j < series.columns.length; j++) {
          table.columns.push({text: series.columns[j]});
        }
      }

      if (series.values) {
        for (i = 0; i < series.values.length; i++) {
          var values = series.values[i];
          var reordered = [parseFloat(values[0])];
          if (series.tags) {
            for (var key in series.tags) {
              if (series.tags.hasOwnProperty(key)) {
                reordered.push(series.tags[key]);
              }
            }
          }
          for (j = 1; j < values.length; j++) {
            reordered.push(values[j]);
          }
          table.rows.push(reordered);
        }
      }
    });

    return table;
  };

  return SqlSeries;
});
