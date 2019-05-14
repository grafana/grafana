import _ from 'lodash';
import TableModel from 'app/core/table_model';
var InfluxSeries = /** @class */ (function () {
    function InfluxSeries(options) {
        this.series = options.series;
        this.alias = options.alias;
        this.annotation = options.annotation;
    }
    InfluxSeries.prototype.getTimeSeries = function () {
        var _this = this;
        var output = [];
        var i, j;
        if (this.series.length === 0) {
            return output;
        }
        _.each(this.series, function (series) {
            var columns = series.columns.length;
            var tags = _.map(series.tags, function (value, key) {
                return key + ': ' + value;
            });
            for (j = 1; j < columns; j++) {
                var seriesName = series.name;
                var columnName = series.columns[j];
                if (columnName !== 'value') {
                    seriesName = seriesName + '.' + columnName;
                }
                if (_this.alias) {
                    seriesName = _this._getSeriesName(series, j);
                }
                else if (series.tags) {
                    seriesName = seriesName + ' {' + tags.join(', ') + '}';
                }
                var datapoints = [];
                if (series.values) {
                    for (i = 0; i < series.values.length; i++) {
                        datapoints[i] = [series.values[i][j], series.values[i][0]];
                    }
                }
                output.push({ target: seriesName, datapoints: datapoints });
            }
        });
        return output;
    };
    InfluxSeries.prototype._getSeriesName = function (series, index) {
        var regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
        var segments = series.name.split('.');
        return this.alias.replace(regex, function (match, g1, g2) {
            var group = g1 || g2;
            var segIndex = parseInt(group, 10);
            if (group === 'm' || group === 'measurement') {
                return series.name;
            }
            if (group === 'col') {
                return series.columns[index];
            }
            if (!isNaN(segIndex)) {
                return segments[segIndex];
            }
            if (group.indexOf('tag_') !== 0) {
                return match;
            }
            var tag = group.replace('tag_', '');
            if (!series.tags) {
                return match;
            }
            return series.tags[tag];
        });
    };
    InfluxSeries.prototype.getAnnotations = function () {
        var _this = this;
        var list = [];
        _.each(this.series, function (series) {
            var titleCol = null;
            var timeCol = null;
            var tagsCol = [];
            var textCol = null;
            _.each(series.columns, function (column, index) {
                if (column === 'time') {
                    timeCol = index;
                    return;
                }
                if (column === 'sequence_number') {
                    return;
                }
                if (column === _this.annotation.titleColumn) {
                    titleCol = index;
                    return;
                }
                if (_.includes((_this.annotation.tagsColumn || '').replace(' ', '').split(','), column)) {
                    tagsCol.push(index);
                    return;
                }
                if (column === _this.annotation.textColumn) {
                    textCol = index;
                    return;
                }
                // legacy case
                if (!titleCol && textCol !== index) {
                    titleCol = index;
                }
            });
            _.each(series.values, function (value) {
                var data = {
                    annotation: _this.annotation,
                    time: +new Date(value[timeCol]),
                    title: value[titleCol],
                    // Remove empty values, then split in different tags for comma separated values
                    tags: _.flatten(tagsCol
                        .filter(function (t) {
                        return value[t];
                    })
                        .map(function (t) {
                        return value[t].split(',');
                    })),
                    text: value[textCol],
                };
                list.push(data);
            });
        });
        return list;
    };
    InfluxSeries.prototype.getTable = function () {
        var table = new TableModel();
        var i, j;
        if (this.series.length === 0) {
            return table;
        }
        _.each(this.series, function (series, seriesIndex) {
            if (seriesIndex === 0) {
                j = 0;
                // Check that the first column is indeed 'time'
                if (series.columns[0] === 'time') {
                    // Push this now before the tags and with the right type
                    table.columns.push({ text: 'Time', type: 'time' });
                    j++;
                }
                _.each(_.keys(series.tags), function (key) {
                    table.columns.push({ text: key });
                });
                for (; j < series.columns.length; j++) {
                    table.columns.push({ text: series.columns[j] });
                }
            }
            if (series.values) {
                for (i = 0; i < series.values.length; i++) {
                    var values = series.values[i];
                    var reordered = [values[0]];
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
    return InfluxSeries;
}());
export default InfluxSeries;
//# sourceMappingURL=influx_series.js.map