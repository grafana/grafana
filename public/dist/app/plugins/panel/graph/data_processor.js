import _ from 'lodash';
import { colors, getColorFromHexRgbOrName } from '@grafana/ui';
import TimeSeries from 'app/core/time_series2';
import config from 'app/core/config';
var DataProcessor = /** @class */ (function () {
    function DataProcessor(panel, dashboard) {
        this.panel = panel;
        this.dashboard = dashboard;
    }
    DataProcessor.prototype.getSeriesList = function (options) {
        var _this = this;
        if (!options.dataList || options.dataList.length === 0) {
            return [];
        }
        // auto detect xaxis mode
        var firstItem;
        if (options.dataList && options.dataList.length > 0) {
            firstItem = options.dataList[0];
            var autoDetectMode = this.getAutoDetectXAxisMode(firstItem);
            if (this.panel.xaxis.mode !== autoDetectMode) {
                this.panel.xaxis.mode = autoDetectMode;
                this.setPanelDefaultsForNewXAxisMode();
            }
        }
        switch (this.panel.xaxis.mode) {
            case 'series':
            case 'time': {
                return options.dataList.map(function (item, index) {
                    return _this.timeSeriesHandler(item, index, options);
                });
            }
            case 'histogram': {
                var histogramDataList = void 0;
                if (this.panel.stack) {
                    histogramDataList = options.dataList;
                }
                else {
                    histogramDataList = [
                        {
                            target: 'count',
                            datapoints: _.concat([], _.flatten(_.map(options.dataList, 'datapoints'))),
                        },
                    ];
                }
                return histogramDataList.map(function (item, index) {
                    return _this.timeSeriesHandler(item, index, options);
                });
            }
            case 'field': {
                return this.customHandler(firstItem);
            }
        }
    };
    DataProcessor.prototype.getAutoDetectXAxisMode = function (firstItem) {
        switch (firstItem.type) {
            case 'docs':
                return 'field';
            case 'table':
                return 'field';
            default: {
                if (this.panel.xaxis.mode === 'series') {
                    return 'series';
                }
                if (this.panel.xaxis.mode === 'histogram') {
                    return 'histogram';
                }
                return 'time';
            }
        }
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
    DataProcessor.prototype.timeSeriesHandler = function (seriesData, index, options) {
        var datapoints = seriesData.datapoints || [];
        var alias = seriesData.target;
        var colorIndex = index % colors.length;
        var customColorsIndex = index % this.panel.colors.length;
        var customDashColorsIndex = index % this.dashboard.colors.length;
        var color = this.panel.aliasColors[alias] ||
            this.panel.colors[customColorsIndex] ||
            this.dashboard.colors[customDashColorsIndex] ||
            colors[colorIndex];
        var series = new TimeSeries({
            datapoints: datapoints,
            alias: alias,
            color: getColorFromHexRgbOrName(color, config.theme.type),
            unit: seriesData.unit,
        });
        if (datapoints && datapoints.length > 0) {
            var last = datapoints[datapoints.length - 1][1];
            var from = options.range.from;
            if (last - from < -10000) {
                series.isOutsideRange = true;
            }
        }
        return series;
    };
    DataProcessor.prototype.customHandler = function (dataItem) {
        var nameField = this.panel.xaxis.name;
        if (!nameField) {
            throw {
                message: 'No field name specified to use for x-axis, check your axes settings',
            };
        }
        return [];
    };
    DataProcessor.prototype.validateXAxisSeriesValue = function () {
        switch (this.panel.xaxis.mode) {
            case 'series': {
                if (this.panel.xaxis.values.length === 0) {
                    this.panel.xaxis.values = ['total'];
                    return;
                }
                var validOptions = this.getXAxisValueOptions({});
                var found = _.find(validOptions, { value: this.panel.xaxis.values[0] });
                if (!found) {
                    this.panel.xaxis.values = ['total'];
                }
                return;
            }
        }
    };
    DataProcessor.prototype.getDataFieldNames = function (dataList, onlyNumbers) {
        if (dataList.length === 0) {
            return [];
        }
        var fields = [];
        var firstItem = dataList[0];
        var fieldParts = [];
        function getPropertiesRecursive(obj) {
            _.forEach(obj, function (value, key) {
                if (_.isObject(value)) {
                    fieldParts.push(key);
                    getPropertiesRecursive(value);
                }
                else {
                    if (!onlyNumbers || _.isNumber(value)) {
                        var field = fieldParts.concat(key).join('.');
                        fields.push(field);
                    }
                }
            });
            fieldParts.pop();
        }
        if (firstItem.type === 'docs') {
            if (firstItem.datapoints.length === 0) {
                return [];
            }
            getPropertiesRecursive(firstItem.datapoints[0]);
        }
        return fields;
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