import { __assign, __read, __spreadArray, __values } from "tslib";
import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';
import './jquery.flot.events';
import $ from 'jquery';
import { clone, find, flatten, isUndefined, map, max as _max, min as _min, sortBy as _sortBy, toNumber } from 'lodash';
import { tickStep } from 'app/core/utils/ticks';
import { coreModule, updateLegendValues } from 'app/core/core';
import GraphTooltip from './graph_tooltip';
import { ThresholdManager } from './threshold_manager';
import { TimeRegionManager } from './time_region_manager';
import { EventManager } from 'app/features/annotations/all';
import { convertToHistogramData } from './histogram';
import { alignYLevel } from './align_yaxes';
import config from 'app/core/config';
import React from 'react';
import ReactDOM from 'react-dom';
import { Legend } from './Legend/Legend';
import { graphTickFormatter, graphTimeFormat } from '@grafana/ui';
import { provideTheme } from 'app/core/utils/ConfigProvider';
import { DataFrameView, FieldType, formattedValueToString, getDisplayProcessor, getFlotPairsConstant, getTimeField, getValueFormat, hasLinks, LegacyGraphHoverClearEvent, LegacyGraphHoverEvent, PanelEvents, toUtc, } from '@grafana/data';
import { getFieldLinksSupplier } from 'app/angular/panel/panellinks/linkSuppliers';
var LegendWithThemeProvider = provideTheme(Legend);
var GraphElement = /** @class */ (function () {
    function GraphElement(scope, elem, timeSrv) {
        var _this = this;
        this.scope = scope;
        this.elem = elem;
        this.timeSrv = timeSrv;
        this.data = [];
        this.getContextMenuItemsSupplier = function (flotPosition, linksSupplier) {
            return function () {
                // Fixed context menu items
                var items = _this.dashboard.canAddAnnotations()
                    ? [
                        {
                            items: [
                                {
                                    label: 'Add annotation',
                                    ariaLabel: 'Add annotation',
                                    icon: 'comment-alt',
                                    onClick: function () { return _this.eventManager.updateTime({ from: flotPosition.x, to: null }); },
                                },
                            ],
                        },
                    ]
                    : [];
                if (!linksSupplier) {
                    return items;
                }
                var dataLinks = [
                    {
                        items: linksSupplier.getLinks(_this.panel.replaceVariables).map(function (link) {
                            return {
                                label: link.title,
                                ariaLabel: link.title,
                                url: link.href,
                                target: link.target,
                                icon: "" + (link.target === '_self' ? 'link' : 'external-link-alt'),
                                onClick: link.onClick,
                            };
                        }),
                    },
                ];
                return __spreadArray(__spreadArray([], __read(items), false), __read(dataLinks), false);
            };
        };
        this.ctrl = scope.ctrl;
        this.contextMenu = scope.ctrl.contextMenuCtrl;
        this.dashboard = this.ctrl.dashboard;
        this.panel = this.ctrl.panel;
        this.annotations = [];
        this.panelWidth = 0;
        this.eventManager = new EventManager(this.ctrl);
        this.thresholdManager = new ThresholdManager(this.ctrl);
        this.timeRegionManager = new TimeRegionManager(this.ctrl);
        // @ts-ignore
        this.tooltip = new GraphTooltip(this.elem, this.ctrl.dashboard, this.scope, function () {
            return _this.sortedSeries;
        });
        // panel events
        this.ctrl.events.on(PanelEvents.panelTeardown, this.onPanelTeardown.bind(this));
        this.ctrl.events.on(PanelEvents.render, this.onRender.bind(this));
        // global events
        // Using old way here to use the scope unsubscribe model as the new $on function does not take scope
        this.ctrl.dashboard.events.on(LegacyGraphHoverEvent.type, this.onGraphHover.bind(this), this.scope);
        this.ctrl.dashboard.events.on(LegacyGraphHoverClearEvent.type, this.onGraphHoverClear.bind(this), this.scope);
        // plot events
        this.elem.bind('plotselected', this.onPlotSelected.bind(this));
        this.elem.bind('plotclick', this.onPlotClick.bind(this));
        // get graph legend element
        if (this.elem && this.elem.parent) {
            this.legendElem = this.elem.parent().find('.graph-legend')[0];
        }
    }
    GraphElement.prototype.onRender = function (renderData) {
        var _this = this;
        this.data = renderData || this.data;
        if (!this.data) {
            return;
        }
        this.annotations = this.ctrl.annotations || [];
        this.buildFlotPairs(this.data);
        var graphHeight = this.ctrl.height;
        updateLegendValues(this.data, this.panel, graphHeight);
        if (!this.panel.legend.show) {
            if (this.legendElem.hasChildNodes()) {
                ReactDOM.unmountComponentAtNode(this.legendElem);
            }
            this.renderPanel();
            return;
        }
        var _a = this.panel.legend, values = _a.values, min = _a.min, max = _a.max, avg = _a.avg, current = _a.current, total = _a.total;
        var _b = this.panel.legend, alignAsTable = _b.alignAsTable, rightSide = _b.rightSide, sideWidth = _b.sideWidth, sort = _b.sort, sortDesc = _b.sortDesc, hideEmpty = _b.hideEmpty, hideZero = _b.hideZero;
        var legendOptions = { alignAsTable: alignAsTable, rightSide: rightSide, sideWidth: sideWidth, sort: sort, sortDesc: sortDesc, hideEmpty: hideEmpty, hideZero: hideZero };
        var valueOptions = { values: values, min: min, max: max, avg: avg, current: current, total: total };
        var legendProps = __assign(__assign(__assign({ seriesList: this.data, hiddenSeries: this.ctrl.hiddenSeries }, legendOptions), valueOptions), { onToggleSeries: this.ctrl.onToggleSeries, onToggleSort: this.ctrl.onToggleSort, onColorChange: this.ctrl.onColorChange, onToggleAxis: this.ctrl.onToggleAxis });
        var legendReactElem = React.createElement(LegendWithThemeProvider, legendProps);
        ReactDOM.render(legendReactElem, this.legendElem, function () { return _this.renderPanel(); });
    };
    GraphElement.prototype.onGraphHover = function (evt) {
        // ignore other graph hover events if shared tooltip is disabled
        if (!this.dashboard.sharedTooltipModeEnabled()) {
            return;
        }
        // ignore if we are the emitter
        if (!this.plot || evt.panel.id === this.panel.id || this.ctrl.otherPanelInFullscreenMode()) {
            return;
        }
        this.tooltip.show(evt.pos);
    };
    GraphElement.prototype.onPanelTeardown = function () {
        if (this.plot) {
            this.plot.destroy();
            this.plot = null;
        }
        this.tooltip.destroy();
        this.elem.off();
        this.elem.remove();
        ReactDOM.unmountComponentAtNode(this.legendElem);
    };
    GraphElement.prototype.onGraphHoverClear = function (handler) {
        if (this.plot) {
            this.tooltip.clear(this.plot);
        }
    };
    GraphElement.prototype.onPlotSelected = function (event, ranges) {
        var _this = this;
        if (this.panel.xaxis.mode !== 'time') {
            // Skip if panel in histogram or series mode
            this.plot.clearSelection();
            return;
        }
        if ((ranges.ctrlKey || ranges.metaKey) && this.dashboard.canAddAnnotations()) {
            // Add annotation
            setTimeout(function () {
                _this.eventManager.updateTime(ranges.xaxis);
            }, 100);
        }
        else {
            this.scope.$apply(function () {
                _this.timeSrv.setTime({
                    from: toUtc(ranges.xaxis.from),
                    to: toUtc(ranges.xaxis.to),
                });
            });
        }
    };
    GraphElement.prototype.onPlotClick = function (event, pos, item) {
        var _this = this;
        var scrollContextElement = this.elem.closest('.view') ? this.elem.closest('.view').get()[0] : null;
        var contextMenuSourceItem = item;
        if (this.panel.xaxis.mode !== 'time') {
            // Skip if panel in histogram or series mode
            return;
        }
        if (pos.ctrlKey || pos.metaKey) {
            // Skip if range selected (added in "plotselected" event handler)
            if (pos.x !== pos.x1) {
                return;
            }
            // skip if dashboard is not saved yet (exists in db) or user cannot edit
            if (!this.dashboard.id || !this.dashboard.canAddAnnotations()) {
                return;
            }
            setTimeout(function () {
                _this.eventManager.updateTime({ from: pos.x, to: null });
            }, 100);
            return;
        }
        else {
            this.tooltip.clear(this.plot);
            var linksSupplier_1;
            if (item) {
                // pickup y-axis index to know which field's config to apply
                var yAxisConfig = this.panel.yaxes[item.series.yaxis.n === 2 ? 1 : 0];
                var dataFrame = this.ctrl.dataList[item.series.dataFrameIndex];
                var field = dataFrame.fields[item.series.fieldIndex];
                var dataIndex = this.getDataIndexWithNullValuesCorrection(item, dataFrame);
                var links = this.panel.options.dataLinks || [];
                var hasLinksValue = hasLinks(field);
                if (hasLinksValue) {
                    // Append the configured links to the panel datalinks
                    links = __spreadArray(__spreadArray([], __read(links), false), __read(field.config.links), false);
                }
                var fieldConfig = {
                    decimals: yAxisConfig.decimals,
                    links: links,
                };
                var fieldDisplay = getDisplayProcessor({
                    field: { config: fieldConfig, type: FieldType.number },
                    theme: config.theme2,
                    timeZone: this.dashboard.getTimezone(),
                })(field.values.get(dataIndex));
                linksSupplier_1 = links.length
                    ? getFieldLinksSupplier({
                        display: fieldDisplay,
                        name: field.name,
                        view: new DataFrameView(dataFrame),
                        rowIndex: dataIndex,
                        colIndex: item.series.fieldIndex,
                        field: fieldConfig,
                        hasLinks: hasLinksValue,
                    })
                    : undefined;
            }
            this.scope.$apply(function () {
                // Setting nearest CustomScrollbar element as a scroll context for graph context menu
                _this.contextMenu.setScrollContextElement(scrollContextElement);
                _this.contextMenu.setSource(contextMenuSourceItem);
                _this.contextMenu.setMenuItemsSupplier(_this.getContextMenuItemsSupplier(pos, linksSupplier_1));
                _this.contextMenu.toggleMenu(pos);
            });
        }
    };
    GraphElement.prototype.getDataIndexWithNullValuesCorrection = function (item, dataFrame) {
        /** This is one added to handle the scenario where we have null values in
         *  the time series data and the: "visualization options -> null value"
         *  set to "connected". In this scenario we will get the wrong dataIndex.
         *
         *  https://github.com/grafana/grafana/issues/22651
         */
        var datapoint = item.datapoint, dataIndex = item.dataIndex;
        if (!Array.isArray(datapoint) || datapoint.length === 0) {
            return dataIndex;
        }
        var ts = datapoint[0];
        var timeField = getTimeField(dataFrame).timeField;
        if (!timeField || !timeField.values) {
            return dataIndex;
        }
        var field = timeField.values.get(dataIndex);
        if (field === ts) {
            return dataIndex;
        }
        var correctIndex = timeField.values.toArray().findIndex(function (value) { return value === ts; });
        return correctIndex > -1 ? correctIndex : dataIndex;
    };
    GraphElement.prototype.shouldAbortRender = function () {
        if (!this.data) {
            return true;
        }
        if (this.panelWidth === 0) {
            return true;
        }
        return false;
    };
    GraphElement.prototype.drawHook = function (plot) {
        // add left axis labels
        if (this.panel.yaxes[0].label && this.panel.yaxes[0].show) {
            $("<div class='axisLabel left-yaxis-label flot-temp-elem'></div>")
                .text(this.panel.yaxes[0].label)
                .appendTo(this.elem);
        }
        // add right axis labels
        if (this.panel.yaxes[1].label && this.panel.yaxes[1].show) {
            $("<div class='axisLabel right-yaxis-label flot-temp-elem'></div>")
                .text(this.panel.yaxes[1].label)
                .appendTo(this.elem);
        }
        var dataWarning = this.ctrl.dataWarning;
        if (dataWarning) {
            var msg = $("<div class=\"datapoints-warning flot-temp-elem\">" + dataWarning.title + "</div>");
            if (dataWarning.action) {
                $("<button class=\"btn btn-secondary\">" + dataWarning.actionText + "</button>")
                    .click(dataWarning.action)
                    .appendTo(msg);
            }
            msg.appendTo(this.elem);
        }
        this.thresholdManager.draw(plot);
        this.timeRegionManager.draw(plot);
    };
    GraphElement.prototype.processOffsetHook = function (plot, gridMargin) {
        var left = this.panel.yaxes[0];
        var right = this.panel.yaxes[1];
        if (left.show && left.label) {
            gridMargin.left = 20;
        }
        if (right.show && right.label) {
            gridMargin.right = 20;
        }
        // apply y-axis min/max options
        var yaxis = plot.getYAxes();
        for (var i = 0; i < yaxis.length; i++) {
            var axis = yaxis[i];
            var panelOptions = this.panel.yaxes[i];
            axis.options.max = axis.options.max !== null ? axis.options.max : panelOptions.max;
            axis.options.min = axis.options.min !== null ? axis.options.min : panelOptions.min;
        }
    };
    GraphElement.prototype.processRangeHook = function (plot) {
        var yAxes = plot.getYAxes();
        var align = this.panel.yaxis.align || false;
        if (yAxes.length > 1 && align === true) {
            var level = this.panel.yaxis.alignLevel || 0;
            alignYLevel(yAxes, parseFloat(level));
        }
    };
    // Series could have different timeSteps,
    // let's find the smallest one so that bars are correctly rendered.
    // In addition, only take series which are rendered as bars for this.
    GraphElement.prototype.getMinTimeStepOfSeries = function (data) {
        var min = Number.MAX_VALUE;
        for (var i = 0; i < data.length; i++) {
            if (!data[i].stats.timeStep) {
                continue;
            }
            if (this.panel.bars) {
                if (data[i].bars && data[i].bars.show === false) {
                    continue;
                }
            }
            else {
                if (typeof data[i].bars === 'undefined' || typeof data[i].bars.show === 'undefined' || !data[i].bars.show) {
                    continue;
                }
            }
            if (data[i].stats.timeStep < min) {
                min = data[i].stats.timeStep;
            }
        }
        return min;
    };
    // Function for rendering panel
    GraphElement.prototype.renderPanel = function () {
        var _a;
        this.panelWidth = (_a = this.elem.width()) !== null && _a !== void 0 ? _a : 0;
        if (this.shouldAbortRender()) {
            return;
        }
        // give space to alert editing
        this.thresholdManager.prepare(this.elem, this.data);
        // un-check dashes if lines are unchecked
        this.panel.dashes = this.panel.lines ? this.panel.dashes : false;
        // Populate element
        var options = this.buildFlotOptions(this.panel);
        this.prepareXAxis(options, this.panel);
        this.configureYAxisOptions(this.data, options);
        this.thresholdManager.addFlotOptions(options, this.panel);
        this.timeRegionManager.addFlotOptions(options, this.panel);
        this.eventManager.addFlotEvents(this.annotations, options);
        this.sortedSeries = this.sortSeries(this.data, this.panel);
        this.callPlot(options, true);
    };
    GraphElement.prototype.buildFlotPairs = function (data) {
        for (var i = 0; i < data.length; i++) {
            var series = data[i];
            series.data = series.getFlotPairs(series.nullPointMode || this.panel.nullPointMode);
            if (series.transform === 'constant') {
                series.data = getFlotPairsConstant(series.data, this.ctrl.range);
            }
            // if hidden remove points and disable stack
            if (this.ctrl.hiddenSeries[series.alias]) {
                series.data = [];
                series.stack = false;
            }
        }
    };
    GraphElement.prototype.prepareXAxis = function (options, panel) {
        switch (panel.xaxis.mode) {
            case 'series': {
                options.series.bars.barWidth = 0.7;
                options.series.bars.align = 'center';
                for (var i = 0; i < this.data.length; i++) {
                    var series = this.data[i];
                    series.data = [[i + 1, series.stats[panel.xaxis.values[0]]]];
                }
                this.addXSeriesAxis(options);
                break;
            }
            case 'histogram': {
                var bucketSize = void 0;
                if (this.data.length) {
                    var histMin = _min(map(this.data, function (s) { return s.stats.min; }));
                    var histMax = _max(map(this.data, function (s) { return s.stats.max; }));
                    var ticks = panel.xaxis.buckets || this.panelWidth / 50;
                    if (panel.xaxis.min != null) {
                        var isInvalidXaxisMin = tickStep(panel.xaxis.min, histMax, ticks) <= 0;
                        histMin = isInvalidXaxisMin ? histMin : panel.xaxis.min;
                    }
                    if (panel.xaxis.max != null) {
                        var isInvalidXaxisMax = tickStep(histMin, panel.xaxis.max, ticks) <= 0;
                        histMax = isInvalidXaxisMax ? histMax : panel.xaxis.max;
                    }
                    bucketSize = tickStep(histMin, histMax, ticks);
                    options.series.bars.barWidth = bucketSize * 0.8;
                    this.data = convertToHistogramData(this.data, bucketSize, this.ctrl.hiddenSeries, histMin, histMax);
                }
                else {
                    bucketSize = 0;
                }
                this.addXHistogramAxis(options, bucketSize);
                break;
            }
            case 'table': {
                options.series.bars.barWidth = 0.7;
                options.series.bars.align = 'center';
                this.addXTableAxis(options);
                break;
            }
            default: {
                options.series.bars.barWidth = this.getMinTimeStepOfSeries(this.data) / 1.5;
                this.addTimeAxis(options);
                break;
            }
        }
    };
    GraphElement.prototype.callPlot = function (options, incrementRenderCounter) {
        try {
            this.plot = $.plot(this.elem, this.sortedSeries, options);
            if (this.ctrl.renderError) {
                delete this.ctrl.error;
            }
        }
        catch (e) {
            console.error('flotcharts error', e);
            this.ctrl.error = e.message || 'Render Error';
            this.ctrl.renderError = true;
        }
        if (incrementRenderCounter) {
            this.ctrl.renderingCompleted();
        }
    };
    GraphElement.prototype.buildFlotOptions = function (panel) {
        var gridColor = '#c8c8c8';
        if (config.bootData.user.lightTheme === true) {
            gridColor = '#a1a1a1';
        }
        var stack = panel.stack ? true : null;
        var options = {
            hooks: {
                draw: [this.drawHook.bind(this)],
                processOffset: [this.processOffsetHook.bind(this)],
                processRange: [this.processRangeHook.bind(this)],
            },
            legend: { show: false },
            series: {
                stackpercent: panel.stack ? panel.percentage : false,
                stack: panel.percentage ? null : stack,
                lines: {
                    show: panel.lines,
                    zero: false,
                    fill: this.translateFillOption(panel.fill),
                    fillColor: this.getFillGradient(panel.fillGradient),
                    lineWidth: panel.dashes ? 0 : panel.linewidth,
                    steps: panel.steppedLine,
                },
                dashes: {
                    show: panel.dashes,
                    lineWidth: panel.linewidth,
                    dashLength: [panel.dashLength, panel.spaceLength],
                },
                bars: {
                    show: panel.bars,
                    fill: 1,
                    barWidth: 1,
                    zero: false,
                    lineWidth: 0,
                },
                points: {
                    show: panel.points,
                    fill: 1,
                    fillColor: false,
                    radius: panel.points ? panel.pointradius : 2,
                },
                shadowSize: 0,
            },
            yaxes: [],
            xaxis: {},
            grid: {
                minBorderMargin: 0,
                markings: [],
                backgroundColor: null,
                borderWidth: 0,
                hoverable: true,
                clickable: true,
                color: gridColor,
                margin: { left: 0, right: 0 },
                labelMarginX: 0,
                mouseActiveRadius: 30,
            },
            selection: {
                mode: 'x',
                color: '#666',
            },
            crosshair: {
                mode: 'x',
            },
        };
        return options;
    };
    GraphElement.prototype.sortSeries = function (series, panel) {
        var sortBy = panel.legend.sort;
        var sortOrder = panel.legend.sortDesc;
        var haveSortBy = sortBy !== null && sortBy !== undefined && panel.legend[sortBy];
        var haveSortOrder = sortOrder !== null && sortOrder !== undefined;
        var shouldSortBy = panel.stack && haveSortBy && haveSortOrder && panel.legend.alignAsTable;
        var sortDesc = panel.legend.sortDesc === true ? -1 : 1;
        if (shouldSortBy) {
            return _sortBy(series, function (s) { return s.stats[sortBy] * sortDesc; });
        }
        else {
            return _sortBy(series, function (s) { return s.zindex; });
        }
    };
    GraphElement.prototype.getFillGradient = function (amount) {
        if (!amount) {
            return null;
        }
        return {
            colors: [{ opacity: 0.0 }, { opacity: amount / 10 }],
        };
    };
    GraphElement.prototype.translateFillOption = function (fill) {
        if (this.panel.percentage && this.panel.stack) {
            return fill === 0 ? 0.001 : fill / 10;
        }
        else {
            return fill / 10;
        }
    };
    GraphElement.prototype.addTimeAxis = function (options) {
        var ticks = this.panelWidth / 100;
        var min = isUndefined(this.ctrl.range.from) ? null : this.ctrl.range.from.valueOf();
        var max = isUndefined(this.ctrl.range.to) ? null : this.ctrl.range.to.valueOf();
        options.xaxis = {
            timezone: this.dashboard.getTimezone(),
            show: this.panel.xaxis.show,
            mode: 'time',
            min: min,
            max: max,
            label: 'Datetime',
            ticks: ticks,
            timeformat: graphTimeFormat(ticks, min, max),
            tickFormatter: graphTickFormatter,
        };
    };
    GraphElement.prototype.addXSeriesAxis = function (options) {
        var ticks = map(this.data, function (series, index) {
            return [index + 1, series.alias];
        });
        options.xaxis = {
            timezone: this.dashboard.getTimezone(),
            show: this.panel.xaxis.show,
            mode: null,
            min: 0,
            max: ticks.length + 1,
            label: 'Datetime',
            ticks: ticks,
        };
    };
    GraphElement.prototype.addXHistogramAxis = function (options, bucketSize) {
        var e_1, _a, e_2, _b;
        var ticks;
        var min;
        var max;
        var defaultTicks = this.panelWidth / 50;
        if (this.data.length && bucketSize) {
            var tickValues = [];
            try {
                for (var _c = __values(this.data), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var d = _d.value;
                    try {
                        for (var _e = (e_2 = void 0, __values(d.data)), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var point = _f.value;
                            tickValues[point[0]] = true;
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            ticks = Object.keys(tickValues).map(function (v) { return Number(v); });
            min = _min(ticks);
            max = _max(ticks);
            // Adjust tick step
            var tickStep_1 = bucketSize;
            var ticksNum = Math.floor((max - min) / tickStep_1);
            while (ticksNum > defaultTicks) {
                tickStep_1 = tickStep_1 * 2;
                ticksNum = Math.ceil((max - min) / tickStep_1);
            }
            // Expand ticks for pretty view
            min = Math.floor(min / tickStep_1) * tickStep_1;
            // 1.01 is 101% - ensure we have enough space for last bar
            max = Math.ceil((max * 1.01) / tickStep_1) * tickStep_1;
            ticks = [];
            for (var i = min; i <= max; i += tickStep_1) {
                ticks.push(i);
            }
        }
        else {
            // Set defaults if no data
            ticks = defaultTicks / 2;
            min = 0;
            max = 1;
        }
        options.xaxis = {
            timezone: this.dashboard.getTimezone(),
            show: this.panel.xaxis.show,
            mode: null,
            min: min,
            max: max,
            label: 'Histogram',
            ticks: ticks,
        };
        // Use 'short' format for histogram values
        this.configureAxisMode(options.xaxis, 'short', null);
    };
    GraphElement.prototype.addXTableAxis = function (options) {
        var ticks = map(this.data, function (series, seriesIndex) {
            return map(series.datapoints, function (point, pointIndex) {
                var tickIndex = seriesIndex * series.datapoints.length + pointIndex;
                return [tickIndex + 1, point[1]];
            });
        });
        // @ts-ignore, potential bug? is this flattenDeep?
        ticks = flatten(ticks, true);
        options.xaxis = {
            timezone: this.dashboard.getTimezone(),
            show: this.panel.xaxis.show,
            mode: null,
            min: 0,
            max: ticks.length + 1,
            label: 'Datetime',
            ticks: ticks,
        };
    };
    GraphElement.prototype.configureYAxisOptions = function (data, options) {
        var defaults = {
            position: 'left',
            show: this.panel.yaxes[0].show,
            index: 1,
            logBase: this.panel.yaxes[0].logBase || 1,
            min: this.parseNumber(this.panel.yaxes[0].min),
            max: this.parseNumber(this.panel.yaxes[0].max),
            tickDecimals: this.panel.yaxes[0].decimals,
        };
        options.yaxes.push(defaults);
        if (find(data, { yaxis: 2 })) {
            var secondY = clone(defaults);
            secondY.index = 2;
            secondY.show = this.panel.yaxes[1].show;
            secondY.logBase = this.panel.yaxes[1].logBase || 1;
            secondY.position = 'right';
            secondY.min = this.parseNumber(this.panel.yaxes[1].min);
            secondY.max = this.parseNumber(this.panel.yaxes[1].max);
            secondY.tickDecimals = this.panel.yaxes[1].decimals;
            options.yaxes.push(secondY);
            this.applyLogScale(options.yaxes[1], data);
            this.configureAxisMode(options.yaxes[1], this.panel.percentage && this.panel.stack ? 'percent' : this.panel.yaxes[1].format, this.panel.yaxes[1].decimals);
        }
        this.applyLogScale(options.yaxes[0], data);
        this.configureAxisMode(options.yaxes[0], this.panel.percentage && this.panel.stack ? 'percent' : this.panel.yaxes[0].format, this.panel.yaxes[0].decimals);
    };
    GraphElement.prototype.parseNumber = function (value) {
        if (value === null || typeof value === 'undefined') {
            return null;
        }
        return toNumber(value);
    };
    GraphElement.prototype.applyLogScale = function (axis, data) {
        if (axis.logBase === 1) {
            return;
        }
        var minSetToZero = axis.min === 0;
        if (axis.min < Number.MIN_VALUE) {
            axis.min = null;
        }
        if (axis.max < Number.MIN_VALUE) {
            axis.max = null;
        }
        var series, i;
        var max = axis.max, min = axis.min;
        for (i = 0; i < data.length; i++) {
            series = data[i];
            if (series.yaxis === axis.index) {
                if (!max || max < series.stats.max) {
                    max = series.stats.max;
                }
                if (!min || min > series.stats.logmin) {
                    min = series.stats.logmin;
                }
            }
        }
        axis.transform = function (v) {
            return v < Number.MIN_VALUE ? null : Math.log(v) / Math.log(axis.logBase);
        };
        axis.inverseTransform = function (v) {
            return Math.pow(axis.logBase, v);
        };
        if (!max && !min) {
            max = axis.inverseTransform(+2);
            min = axis.inverseTransform(-2);
        }
        else if (!max) {
            max = min * axis.inverseTransform(+4);
        }
        else if (!min) {
            min = max * axis.inverseTransform(-4);
        }
        if (axis.min) {
            min = axis.inverseTransform(Math.ceil(axis.transform(axis.min)));
        }
        else {
            min = axis.min = axis.inverseTransform(Math.floor(axis.transform(min)));
        }
        if (axis.max) {
            max = axis.inverseTransform(Math.floor(axis.transform(axis.max)));
        }
        else {
            max = axis.max = axis.inverseTransform(Math.ceil(axis.transform(max)));
        }
        if (!min || min < Number.MIN_VALUE || !max || max < Number.MIN_VALUE) {
            return;
        }
        if (Number.isFinite(min) && Number.isFinite(max)) {
            if (minSetToZero) {
                axis.min = 0.1;
                min = 1;
            }
            axis.ticks = this.generateTicksForLogScaleYAxis(min, max, axis.logBase);
            if (minSetToZero) {
                axis.ticks.unshift(0.1);
            }
            if (axis.ticks[axis.ticks.length - 1] > axis.max) {
                axis.max = axis.ticks[axis.ticks.length - 1];
            }
        }
        else {
            axis.ticks = [1, 2];
            delete axis.min;
            delete axis.max;
        }
    };
    GraphElement.prototype.generateTicksForLogScaleYAxis = function (min, max, logBase) {
        var ticks = [];
        var nextTick;
        for (nextTick = min; nextTick <= max; nextTick *= logBase) {
            ticks.push(nextTick);
        }
        var maxNumTicks = Math.ceil(this.ctrl.height / 25);
        var numTicks = ticks.length;
        if (numTicks > maxNumTicks) {
            var factor = Math.ceil(numTicks / maxNumTicks) * logBase;
            ticks = [];
            for (nextTick = min; nextTick <= max * factor; nextTick *= factor) {
                ticks.push(nextTick);
            }
        }
        return ticks;
    };
    GraphElement.prototype.configureAxisMode = function (axis, format, decimals) {
        axis.tickFormatter = function (val, axis) {
            var formatter = getValueFormat(format);
            if (!formatter) {
                throw new Error("Unit '" + format + "' is not supported");
            }
            return formattedValueToString(formatter(val, decimals));
        };
    };
    return GraphElement;
}());
/** @ngInject */
function graphDirective(timeSrv, popoverSrv, contextSrv) {
    return {
        restrict: 'A',
        template: '',
        link: function (scope, elem) {
            return new GraphElement(scope, elem, timeSrv);
        },
    };
}
coreModule.directive('grafanaGraph', graphDirective);
export { GraphElement, graphDirective };
//# sourceMappingURL=graph.js.map