import { __assign, __extends, __read, __spreadArray } from "tslib";
// Libraries
import $ from 'jquery';
import React, { PureComponent } from 'react';
import { uniqBy } from 'lodash';
// Types
import { TooltipDisplayMode } from '@grafana/schema';
import { createDimension } from '@grafana/data';
import { VizTooltip } from '../VizTooltip';
import { GraphTooltip } from './GraphTooltip/GraphTooltip';
import { GraphContextMenu } from './GraphContextMenu';
import { graphTimeFormat, graphTickFormatter } from './utils';
var Graph = /** @class */ (function (_super) {
    __extends(Graph, _super);
    function Graph() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isTooltipVisible: false,
            isContextVisible: false,
        };
        _this.element = null;
        _this.onPlotSelected = function (event, ranges) {
            var onHorizontalRegionSelected = _this.props.onHorizontalRegionSelected;
            if (onHorizontalRegionSelected) {
                onHorizontalRegionSelected(ranges.xaxis.from, ranges.xaxis.to);
            }
        };
        _this.onPlotHover = function (event, pos, item) {
            _this.setState({
                isTooltipVisible: true,
                activeItem: item,
                pos: pos,
            });
        };
        _this.onPlotClick = function (event, contextPos, item) {
            _this.setState({
                isContextVisible: true,
                isTooltipVisible: false,
                contextItem: item,
                contextPos: contextPos,
            });
        };
        _this.renderTooltip = function () {
            var _a = _this.props, children = _a.children, series = _a.series, timeZone = _a.timeZone;
            var _b = _this.state, pos = _b.pos, activeItem = _b.activeItem, isTooltipVisible = _b.isTooltipVisible;
            var tooltipElement = null;
            if (!isTooltipVisible || !pos || series.length === 0) {
                return null;
            }
            // Find children that indicate tooltip to be rendered
            React.Children.forEach(children, function (c) {
                // We have already found tooltip
                if (tooltipElement) {
                    return;
                }
                // @ts-ignore
                var childType = c && c.type && (c.type.displayName || c.type.name);
                if (childType === VizTooltip.displayName) {
                    tooltipElement = c;
                }
            });
            // If no tooltip provided, skip rendering
            if (!tooltipElement) {
                return null;
            }
            var tooltipElementProps = tooltipElement.props;
            var tooltipMode = tooltipElementProps.mode || 'single';
            // If mode is single series and user is not hovering over item, skip rendering
            if (!activeItem && tooltipMode === 'single') {
                return null;
            }
            // Check if tooltip needs to be rendered with custom tooltip component, otherwise default to GraphTooltip
            var tooltipContentRenderer = tooltipElementProps.tooltipComponent || GraphTooltip;
            // Indicates column(field) index in y-axis dimension
            var seriesIndex = activeItem ? activeItem.series.seriesIndex : 0;
            // Indicates row index in active field values
            var rowIndex = activeItem ? activeItem.dataIndex : undefined;
            var activeDimensions = {
                // Described x-axis active item
                // When hovering over an item - let's take it's dataIndex, otherwise undefined
                // Tooltip itself needs to figure out correct datapoint display information based on pos passed to it
                xAxis: [seriesIndex, rowIndex],
                // Describes y-axis active item
                yAxis: activeItem ? [activeItem.series.seriesIndex, activeItem.dataIndex] : null,
            };
            var tooltipContentProps = {
                dimensions: {
                    // time/value dimension columns are index-aligned - see getGraphSeriesModel
                    xAxis: createDimension('xAxis', series.map(function (s) { return s.timeField; })),
                    yAxis: createDimension('yAxis', series.map(function (s) { return s.valueField; })),
                },
                activeDimensions: activeDimensions,
                pos: pos,
                mode: tooltipElementProps.mode || TooltipDisplayMode.Single,
                timeZone: timeZone,
            };
            var tooltipContent = React.createElement(tooltipContentRenderer, __assign({}, tooltipContentProps));
            return React.cloneElement(tooltipElement, {
                content: tooltipContent,
                position: { x: pos.pageX, y: pos.pageY },
                offset: { x: 10, y: 10 },
            });
        };
        _this.renderContextMenu = function () {
            var series = _this.props.series;
            var _a = _this.state, contextPos = _a.contextPos, contextItem = _a.contextItem, isContextVisible = _a.isContextVisible;
            if (!isContextVisible || !contextPos || !contextItem || series.length === 0) {
                return null;
            }
            // Indicates column(field) index in y-axis dimension
            var seriesIndex = contextItem ? contextItem.series.seriesIndex : 0;
            // Indicates row index in context field values
            var rowIndex = contextItem ? contextItem.dataIndex : undefined;
            var contextDimensions = {
                // Described x-axis context item
                xAxis: [seriesIndex, rowIndex],
                // Describes y-axis context item
                yAxis: contextItem ? [contextItem.series.seriesIndex, contextItem.dataIndex] : null,
            };
            var dimensions = {
                // time/value dimension columns are index-aligned - see getGraphSeriesModel
                xAxis: createDimension('xAxis', series.map(function (s) { return s.timeField; })),
                yAxis: createDimension('yAxis', series.map(function (s) { return s.valueField; })),
            };
            var closeContext = function () { return _this.setState({ isContextVisible: false }); };
            var getContextMenuSource = function () {
                return {
                    datapoint: contextItem.datapoint,
                    dataIndex: contextItem.dataIndex,
                    series: contextItem.series,
                    seriesIndex: contextItem.series.seriesIndex,
                    pageX: contextPos.pageX,
                    pageY: contextPos.pageY,
                };
            };
            var contextContentProps = {
                x: contextPos.pageX,
                y: contextPos.pageY,
                onClose: closeContext,
                getContextMenuSource: getContextMenuSource,
                timeZone: _this.props.timeZone,
                dimensions: dimensions,
                contextDimensions: contextDimensions,
            };
            return React.createElement(GraphContextMenu, __assign({}, contextContentProps));
        };
        _this.getBarWidth = function () {
            var series = _this.props.series;
            return Math.min.apply(Math, __spreadArray([], __read(series.map(function (s) { return s.timeStep; })), false));
        };
        return _this;
    }
    Graph.prototype.componentDidUpdate = function (prevProps, prevState) {
        if (prevProps !== this.props) {
            this.draw();
        }
    };
    Graph.prototype.componentDidMount = function () {
        this.draw();
        if (this.element) {
            this.$element = $(this.element);
            this.$element.bind('plotselected', this.onPlotSelected);
            this.$element.bind('plothover', this.onPlotHover);
            this.$element.bind('plotclick', this.onPlotClick);
        }
    };
    Graph.prototype.componentWillUnmount = function () {
        if (this.$element) {
            this.$element.unbind('plotselected', this.onPlotSelected);
        }
    };
    Graph.prototype.getYAxes = function (series) {
        if (series.length === 0) {
            return [{ show: true, min: -1, max: 1 }];
        }
        return uniqBy(series.map(function (s) {
            var index = s.yAxis ? s.yAxis.index : 1;
            var min = s.yAxis && !isNaN(s.yAxis.min) ? s.yAxis.min : null;
            var tickDecimals = s.yAxis && !isNaN(s.yAxis.tickDecimals) ? s.yAxis.tickDecimals : null;
            return {
                show: true,
                index: index,
                position: index === 1 ? 'left' : 'right',
                min: min,
                tickDecimals: tickDecimals,
            };
        }), function (yAxisConfig) { return yAxisConfig.index; });
    };
    Graph.prototype.draw = function () {
        if (this.element === null) {
            return;
        }
        var _a = this.props, width = _a.width, series = _a.series, timeRange = _a.timeRange, showLines = _a.showLines, showBars = _a.showBars, showPoints = _a.showPoints, isStacked = _a.isStacked, lineWidth = _a.lineWidth, timeZone = _a.timeZone, onHorizontalRegionSelected = _a.onHorizontalRegionSelected;
        if (!width) {
            return;
        }
        var ticks = width / 100;
        var min = timeRange.from.valueOf();
        var max = timeRange.to.valueOf();
        var yaxes = this.getYAxes(series);
        var flotOptions = {
            legend: {
                show: false,
            },
            series: {
                stack: isStacked,
                lines: {
                    show: showLines,
                    lineWidth: lineWidth,
                    zero: false,
                },
                points: {
                    show: showPoints,
                    fill: 1,
                    fillColor: false,
                    radius: 2,
                },
                bars: {
                    show: showBars,
                    fill: 1,
                    // Dividig the width by 1.5 to make the bars not touch each other
                    barWidth: showBars ? this.getBarWidth() / 1.5 : 1,
                    zero: false,
                    lineWidth: lineWidth,
                },
                shadowSize: 0,
            },
            xaxis: {
                timezone: timeZone,
                show: true,
                mode: 'time',
                min: min,
                max: max,
                label: 'Datetime',
                ticks: ticks,
                timeformat: graphTimeFormat(ticks, min, max),
                tickFormatter: graphTickFormatter,
            },
            yaxes: yaxes,
            grid: {
                minBorderMargin: 0,
                markings: [],
                backgroundColor: null,
                borderWidth: 0,
                hoverable: true,
                clickable: true,
                color: '#a1a1a1',
                margin: { left: 0, right: 0 },
                labelMarginX: 0,
                mouseActiveRadius: 30,
            },
            selection: {
                mode: onHorizontalRegionSelected ? 'x' : null,
                color: '#666',
            },
            crosshair: {
                mode: 'x',
            },
        };
        try {
            $.plot(this.element, series.filter(function (s) { return s.isVisible; }), flotOptions);
        }
        catch (err) {
            console.error('Graph rendering error', err, flotOptions, series);
            throw new Error('Error rendering panel');
        }
    };
    Graph.prototype.render = function () {
        var _this = this;
        var _a = this.props, ariaLabel = _a.ariaLabel, height = _a.height, width = _a.width, series = _a.series;
        var noDataToBeDisplayed = series.length === 0;
        var tooltip = this.renderTooltip();
        var context = this.renderContextMenu();
        return (React.createElement("div", { className: "graph-panel", "aria-label": ariaLabel },
            React.createElement("div", { className: "graph-panel__chart", ref: function (e) { return (_this.element = e); }, style: { height: height, width: width }, onMouseLeave: function () {
                    _this.setState({ isTooltipVisible: false });
                } }),
            noDataToBeDisplayed && React.createElement("div", { className: "datapoints-warning" }, "No data"),
            tooltip,
            context));
    };
    Graph.defaultProps = {
        showLines: true,
        showPoints: false,
        showBars: false,
        isStacked: false,
        lineWidth: 1,
    };
    return Graph;
}(PureComponent));
export { Graph };
export default Graph;
//# sourceMappingURL=Graph.js.map