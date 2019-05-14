import * as tslib_1 from "tslib";
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import TimeSeries from 'app/core/time_series2';
import { axesEditor } from './axes_editor';
import { heatmapDisplayEditor } from './display_editor';
import rendering from './rendering';
import { convertToHeatMap, convertToCards, histogramToHeatmap, calculateBucketSize, sortSeriesByLabel, } from './heatmap_data_converter';
var X_BUCKET_NUMBER_DEFAULT = 30;
var Y_BUCKET_NUMBER_DEFAULT = 10;
var panelDefaults = {
    heatmap: {},
    cards: {
        cardPadding: null,
        cardRound: null,
    },
    color: {
        mode: 'spectrum',
        cardColor: '#b4ff00',
        colorScale: 'sqrt',
        exponent: 0.5,
        colorScheme: 'interpolateOranges',
    },
    legend: {
        show: false,
    },
    dataFormat: 'timeseries',
    yBucketBound: 'auto',
    reverseYBuckets: false,
    xAxis: {
        show: true,
    },
    yAxis: {
        show: true,
        format: 'short',
        decimals: null,
        logBase: 1,
        splitFactor: null,
        min: null,
        max: null,
    },
    xBucketSize: null,
    xBucketNumber: null,
    yBucketSize: null,
    yBucketNumber: null,
    tooltip: {
        show: true,
        showHistogram: false,
    },
    highlightCards: true,
    hideZeroBuckets: false,
};
var colorModes = ['opacity', 'spectrum'];
var opacityScales = ['linear', 'sqrt'];
// Schemes from d3-scale-chromatic
// https://github.com/d3/d3-scale-chromatic
var colorSchemes = [
    // Diverging
    { name: 'Spectral', value: 'interpolateSpectral', invert: 'always' },
    { name: 'RdYlGn', value: 'interpolateRdYlGn', invert: 'always' },
    // Sequential (Single Hue)
    { name: 'Blues', value: 'interpolateBlues', invert: 'dark' },
    { name: 'Greens', value: 'interpolateGreens', invert: 'dark' },
    { name: 'Greys', value: 'interpolateGreys', invert: 'dark' },
    { name: 'Oranges', value: 'interpolateOranges', invert: 'dark' },
    { name: 'Purples', value: 'interpolatePurples', invert: 'dark' },
    { name: 'Reds', value: 'interpolateReds', invert: 'dark' },
    // Sequential (Multi-Hue)
    { name: 'Viridis', value: 'interpolateViridis', invert: 'light' },
    { name: 'Magma', value: 'interpolateMagma', invert: 'light' },
    { name: 'Inferno', value: 'interpolateInferno', invert: 'light' },
    { name: 'Plasma', value: 'interpolatePlasma', invert: 'light' },
    { name: 'Warm', value: 'interpolateWarm', invert: 'light' },
    { name: 'Cool', value: 'interpolateCool', invert: 'light' },
    { name: 'Cubehelix', value: 'interpolateCubehelixDefault', invert: 'light' },
    { name: 'BuGn', value: 'interpolateBuGn', invert: 'dark' },
    { name: 'BuPu', value: 'interpolateBuPu', invert: 'dark' },
    { name: 'GnBu', value: 'interpolateGnBu', invert: 'dark' },
    { name: 'OrRd', value: 'interpolateOrRd', invert: 'dark' },
    { name: 'PuBuGn', value: 'interpolatePuBuGn', invert: 'dark' },
    { name: 'PuBu', value: 'interpolatePuBu', invert: 'dark' },
    { name: 'PuRd', value: 'interpolatePuRd', invert: 'dark' },
    { name: 'RdPu', value: 'interpolateRdPu', invert: 'dark' },
    { name: 'YlGnBu', value: 'interpolateYlGnBu', invert: 'dark' },
    { name: 'YlGn', value: 'interpolateYlGn', invert: 'dark' },
    { name: 'YlOrBr', value: 'interpolateYlOrBr', invert: 'dark' },
    { name: 'YlOrRd', value: 'interpolateYlOrRd', invert: 'dark' },
];
var dsSupportHistogramSort = ['elasticsearch'];
var HeatmapCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(HeatmapCtrl, _super);
    /** @ngInject */
    function HeatmapCtrl($scope, $injector, timeSrv) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.opacityScales = [];
        _this.colorModes = [];
        _this.colorSchemes = [];
        _this.timeSrv = timeSrv;
        _this.selectionActivated = false;
        _.defaultsDeep(_this.panel, panelDefaults);
        _this.opacityScales = opacityScales;
        _this.colorModes = colorModes;
        _this.colorSchemes = colorSchemes;
        // Bind grafana panel events
        _this.events.on('render', _this.onRender.bind(_this));
        _this.events.on('data-received', _this.onDataReceived.bind(_this));
        _this.events.on('data-error', _this.onDataError.bind(_this));
        _this.events.on('data-snapshot-load', _this.onDataReceived.bind(_this));
        _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));
        _this.onCardColorChange = _this.onCardColorChange.bind(_this);
        return _this;
    }
    HeatmapCtrl.prototype.onInitEditMode = function () {
        this.addEditorTab('Axes', axesEditor, 2);
        this.addEditorTab('Display', heatmapDisplayEditor, 3);
        this.unitFormats = kbn.getUnitFormats();
    };
    HeatmapCtrl.prototype.zoomOut = function (evt) {
        this.publishAppEvent('zoom-out', 2);
    };
    HeatmapCtrl.prototype.onRender = function () {
        if (!this.range || !this.series) {
            return;
        }
        if (this.panel.dataFormat === 'tsbuckets') {
            this.convertHistogramToHeatmapData();
        }
        else {
            this.convertTimeSeriesToHeatmapData();
        }
    };
    HeatmapCtrl.prototype.convertTimeSeriesToHeatmapData = function () {
        var xBucketSize, yBucketSize, bucketsData, heatmapStats;
        var logBase = this.panel.yAxis.logBase;
        var xBucketNumber = this.panel.xBucketNumber || X_BUCKET_NUMBER_DEFAULT;
        var xBucketSizeByNumber = Math.floor((this.range.to - this.range.from) / xBucketNumber);
        // Parse X bucket size (number or interval)
        var isIntervalString = kbn.interval_regex.test(this.panel.xBucketSize);
        if (isIntervalString) {
            xBucketSize = kbn.interval_to_ms(this.panel.xBucketSize);
        }
        else if (isNaN(Number(this.panel.xBucketSize)) ||
            this.panel.xBucketSize === '' ||
            this.panel.xBucketSize === null) {
            xBucketSize = xBucketSizeByNumber;
        }
        else {
            xBucketSize = Number(this.panel.xBucketSize);
        }
        // Calculate Y bucket size
        heatmapStats = this.parseSeries(this.series);
        var yBucketNumber = this.panel.yBucketNumber || Y_BUCKET_NUMBER_DEFAULT;
        if (logBase !== 1) {
            yBucketSize = this.panel.yAxis.splitFactor;
        }
        else {
            if (heatmapStats.max === heatmapStats.min) {
                if (heatmapStats.max) {
                    yBucketSize = heatmapStats.max / Y_BUCKET_NUMBER_DEFAULT;
                }
                else {
                    yBucketSize = 1;
                }
            }
            else {
                yBucketSize = (heatmapStats.max - heatmapStats.min) / yBucketNumber;
            }
            yBucketSize = this.panel.yBucketSize || yBucketSize;
        }
        bucketsData = convertToHeatMap(this.series, yBucketSize, xBucketSize, logBase);
        // Set default Y range if no data
        if (!heatmapStats.min && !heatmapStats.max) {
            heatmapStats = { min: -1, max: 1, minLog: 1 };
            yBucketSize = 1;
        }
        var _a = convertToCards(bucketsData, this.panel.hideZeroBuckets), cards = _a.cards, cardStats = _a.cardStats;
        this.data = {
            buckets: bucketsData,
            heatmapStats: heatmapStats,
            xBucketSize: xBucketSize,
            yBucketSize: yBucketSize,
            cards: cards,
            cardStats: cardStats,
        };
    };
    HeatmapCtrl.prototype.convertHistogramToHeatmapData = function () {
        var panelDatasource = this.getPanelDataSourceType();
        var xBucketSize, yBucketSize, bucketsData, tsBuckets;
        // Try to sort series by bucket bound, if datasource doesn't do it.
        if (!_.includes(dsSupportHistogramSort, panelDatasource)) {
            this.series.sort(sortSeriesByLabel);
        }
        if (this.panel.reverseYBuckets) {
            this.series.reverse();
        }
        // Convert histogram to heatmap. Each histogram bucket represented by the series which name is
        // a top (or bottom, depends of datasource) bucket bound. Further, these values will be used as Y axis labels.
        bucketsData = histogramToHeatmap(this.series);
        tsBuckets = _.map(this.series, 'label');
        var yBucketBound = this.panel.yBucketBound;
        if ((panelDatasource === 'prometheus' && yBucketBound !== 'lower' && yBucketBound !== 'middle') ||
            yBucketBound === 'upper') {
            // Prometheus labels are upper inclusive bounds, so add empty bottom bucket label.
            tsBuckets = [''].concat(tsBuckets);
        }
        else {
            // Elasticsearch uses labels as lower bucket bounds, so add empty top bucket label.
            // Use this as a default mode as well.
            tsBuckets.push('');
        }
        // Calculate bucket size based on heatmap data
        var xBucketBoundSet = _.map(_.keys(bucketsData), function (key) { return Number(key); });
        xBucketSize = calculateBucketSize(xBucketBoundSet);
        // Always let yBucketSize=1 in 'tsbuckets' mode
        yBucketSize = 1;
        var _a = convertToCards(bucketsData, this.panel.hideZeroBuckets), cards = _a.cards, cardStats = _a.cardStats;
        this.data = {
            buckets: bucketsData,
            xBucketSize: xBucketSize,
            yBucketSize: yBucketSize,
            tsBuckets: tsBuckets,
            cards: cards,
            cardStats: cardStats,
        };
    };
    HeatmapCtrl.prototype.getPanelDataSourceType = function () {
        if (this.datasource.meta && this.datasource.meta.id) {
            return this.datasource.meta.id;
        }
        else {
            return 'unknown';
        }
    };
    HeatmapCtrl.prototype.onDataReceived = function (dataList) {
        var e_1, _a;
        this.series = dataList.map(this.seriesHandler.bind(this));
        this.dataWarning = null;
        var datapointsCount = _.reduce(this.series, function (sum, series) {
            return sum + series.datapoints.length;
        }, 0);
        if (datapointsCount === 0) {
            this.dataWarning = {
                title: 'No data points',
                tip: 'No datapoints returned from data query',
            };
        }
        else {
            try {
                for (var _b = tslib_1.__values(this.series), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var series = _c.value;
                    if (series.isOutsideRange) {
                        this.dataWarning = {
                            title: 'Data points outside time range',
                            tip: 'Can be caused by timezone mismatch or missing time filter in query',
                        };
                        break;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        this.render();
    };
    HeatmapCtrl.prototype.onDataError = function () {
        this.series = [];
        this.render();
    };
    HeatmapCtrl.prototype.onCardColorChange = function (newColor) {
        this.panel.color.cardColor = newColor;
        this.render();
    };
    HeatmapCtrl.prototype.seriesHandler = function (seriesData) {
        if (seriesData.datapoints === undefined) {
            throw new Error('Heatmap error: data should be a time series');
        }
        var series = new TimeSeries({
            datapoints: seriesData.datapoints,
            alias: seriesData.target,
        });
        series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
        var datapoints = seriesData.datapoints || [];
        if (datapoints && datapoints.length > 0) {
            var last = datapoints[datapoints.length - 1][1];
            var from = this.range.from;
            if (last - from < -10000) {
                series.isOutsideRange = true;
            }
        }
        return series;
    };
    HeatmapCtrl.prototype.parseSeries = function (series) {
        var min = _.min(_.map(series, function (s) { return s.stats.min; }));
        var minLog = _.min(_.map(series, function (s) { return s.stats.logmin; }));
        var max = _.max(_.map(series, function (s) { return s.stats.max; }));
        return {
            max: max,
            min: min,
            minLog: minLog,
        };
    };
    HeatmapCtrl.prototype.parseHistogramSeries = function (series) {
        var bounds = _.map(series, function (s) { return Number(s.alias); });
        var min = _.min(bounds);
        var minLog = _.min(bounds);
        var max = _.max(bounds);
        return {
            max: max,
            min: min,
            minLog: minLog,
        };
    };
    HeatmapCtrl.prototype.link = function (scope, elem, attrs, ctrl) {
        rendering(scope, elem, attrs, ctrl);
    };
    HeatmapCtrl.templateUrl = 'module.html';
    return HeatmapCtrl;
}(MetricsPanelCtrl));
export { HeatmapCtrl };
//# sourceMappingURL=heatmap_ctrl.js.map