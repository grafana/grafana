import { find } from 'lodash';
import { colors } from '@grafana/ui';
import { dateTime, FieldType, getColorForTheme, getFieldDisplayName, getTimeField, } from '@grafana/data';
import TimeSeries from 'app/core/time_series2';
import config from 'app/core/config';
var DataProcessor = /** @class */ (function () {
    function DataProcessor(panel) {
        this.panel = panel;
    }
    DataProcessor.prototype.getSeriesList = function (options) {
        var list = [];
        var dataList = options.dataList, range = options.range;
        if (!dataList || !dataList.length) {
            return list;
        }
        for (var i = 0; i < dataList.length; i++) {
            var series = dataList[i];
            var timeField = getTimeField(series).timeField;
            if (!timeField) {
                continue;
            }
            for (var j = 0; j < series.fields.length; j++) {
                var field = series.fields[j];
                if (field.type !== FieldType.number) {
                    continue;
                }
                var name_1 = getFieldDisplayName(field, series, dataList);
                var datapoints = [];
                for (var r = 0; r < series.length; r++) {
                    datapoints.push([field.values.get(r), dateTime(timeField.values.get(r)).valueOf()]);
                }
                list.push(this.toTimeSeries(field, name_1, i, j, datapoints, list.length, range));
            }
        }
        // Merge all the rows if we want to show a histogram
        if (this.panel.xaxis.mode === 'histogram' && !this.panel.stack && list.length > 1) {
            var first = list[0];
            first.alias = first.aliasEscaped = 'Count';
            for (var i = 1; i < list.length; i++) {
                first.datapoints = first.datapoints.concat(list[i].datapoints);
            }
            return [first];
        }
        return list;
    };
    DataProcessor.prototype.toTimeSeries = function (field, alias, dataFrameIndex, fieldIndex, datapoints, index, range) {
        var colorIndex = index % colors.length;
        var color = this.panel.aliasColors[alias] || colors[colorIndex];
        var series = new TimeSeries({
            datapoints: datapoints || [],
            alias: alias,
            color: getColorForTheme(color, config.theme),
            unit: field.config ? field.config.unit : undefined,
            dataFrameIndex: dataFrameIndex,
            fieldIndex: fieldIndex,
        });
        if (datapoints && datapoints.length > 0 && range) {
            var last = datapoints[datapoints.length - 1][1];
            var from = range.from;
            if (last - from.valueOf() < -10000) {
                // If the data is in reverse order
                var first = datapoints[0][1];
                if (first - from.valueOf() < -10000) {
                    series.isOutsideRange = true;
                }
            }
        }
        return series;
    };
    DataProcessor.prototype.setPanelDefaultsForNewXAxisMode = function () {
        switch (this.panel.xaxis.mode) {
            case 'time': {
                this.panel.bars = false;
                this.panel.lines = true;
                this.panel.points = false;
                this.panel.legend.show = true;
                this.panel.tooltip.shared = true;
                this.panel.xaxis.values = [];
                break;
            }
            case 'series': {
                this.panel.bars = true;
                this.panel.lines = false;
                this.panel.points = false;
                this.panel.stack = false;
                this.panel.legend.show = false;
                this.panel.tooltip.shared = false;
                this.panel.xaxis.values = ['total'];
                break;
            }
            case 'histogram': {
                this.panel.bars = true;
                this.panel.lines = false;
                this.panel.points = false;
                this.panel.stack = false;
                this.panel.legend.show = false;
                this.panel.tooltip.shared = false;
                break;
            }
        }
    };
    DataProcessor.prototype.validateXAxisSeriesValue = function () {
        switch (this.panel.xaxis.mode) {
            case 'series': {
                if (this.panel.xaxis.values.length === 0) {
                    this.panel.xaxis.values = ['total'];
                    return;
                }
                var validOptions = this.getXAxisValueOptions({});
                var found = find(validOptions, { value: this.panel.xaxis.values[0] });
                if (!found) {
                    this.panel.xaxis.values = ['total'];
                }
                return;
            }
        }
    };
    DataProcessor.prototype.getXAxisValueOptions = function (options) {
        switch (this.panel.xaxis.mode) {
            case 'series': {
                return [
                    { text: 'Avg', value: 'avg' },
                    { text: 'Min', value: 'min' },
                    { text: 'Max', value: 'max' },
                    { text: 'Total', value: 'total' },
                    { text: 'Count', value: 'count' },
                ];
            }
        }
        return [];
    };
    DataProcessor.prototype.pluckDeep = function (obj, property) {
        var propertyParts = property.split('.');
        var value = obj;
        for (var i = 0; i < propertyParts.length; ++i) {
            if (value[propertyParts[i]]) {
                value = value[propertyParts[i]];
            }
            else {
                return undefined;
            }
        }
        return value;
    };
    return DataProcessor;
}());
export { DataProcessor };
//# sourceMappingURL=data_processor.js.map