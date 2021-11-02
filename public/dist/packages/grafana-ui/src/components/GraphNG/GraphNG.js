import { __extends, __values } from "tslib";
import React from 'react';
import { findMidPointYPosition, pluginLog } from '../uPlot/utils';
import { DataHoverClearEvent, DataHoverEvent, FieldMatcherID, fieldMatchers, LegacyGraphHoverEvent, } from '@grafana/data';
import { preparePlotFrame as defaultPreparePlotFrame } from './utils';
import { PanelContextRoot } from '../PanelChrome/PanelContext';
import { Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { VizLayout } from '../VizLayout/VizLayout';
import { UPlotChart } from '../uPlot/Plot';
/**
 * @internal -- not a public API
 */
export var FIXED_UNIT = '__fixed';
function sameProps(prevProps, nextProps, propsToDiff) {
    var e_1, _a;
    if (propsToDiff === void 0) { propsToDiff = []; }
    try {
        for (var propsToDiff_1 = __values(propsToDiff), propsToDiff_1_1 = propsToDiff_1.next(); !propsToDiff_1_1.done; propsToDiff_1_1 = propsToDiff_1.next()) {
            var propName = propsToDiff_1_1.value;
            if (typeof propName === 'function') {
                if (!propName(prevProps, nextProps)) {
                    return false;
                }
            }
            else if (nextProps[propName] !== prevProps[propName]) {
                return false;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (propsToDiff_1_1 && !propsToDiff_1_1.done && (_a = propsToDiff_1.return)) _a.call(propsToDiff_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return true;
}
/**
 * "Time as X" core component, expects ascending x
 */
var GraphNG = /** @class */ (function (_super) {
    __extends(GraphNG, _super);
    function GraphNG(props) {
        var _this = _super.call(this, props) || this;
        _this.panelContext = {};
        _this.subscription = new Subscription();
        _this.getTimeRange = function () { return _this.props.timeRange; };
        _this.state = _this.prepState(props);
        _this.plotInstance = React.createRef();
        return _this;
    }
    GraphNG.prototype.prepState = function (props, withConfig) {
        var _a;
        if (withConfig === void 0) { withConfig = true; }
        var state = null;
        var frames = props.frames, fields = props.fields, preparePlotFrame = props.preparePlotFrame;
        var preparePlotFrameFn = preparePlotFrame || defaultPreparePlotFrame;
        var alignedFrame = preparePlotFrameFn(frames, fields || {
            x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
            y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
        });
        pluginLog('GraphNG', false, 'data aligned', alignedFrame);
        if (alignedFrame) {
            var config = (_a = this.state) === null || _a === void 0 ? void 0 : _a.config;
            if (withConfig) {
                config = props.prepConfig(alignedFrame, this.props.frames, this.getTimeRange);
                pluginLog('GraphNG', false, 'config prepared', config);
            }
            state = {
                alignedFrame: alignedFrame,
                alignedData: config.prepData([alignedFrame]),
                config: config,
            };
            pluginLog('GraphNG', false, 'data prepared', state.alignedData);
        }
        return state;
    };
    GraphNG.prototype.handleCursorUpdate = function (evt) {
        var _a, _b;
        var time = (_b = (_a = evt.payload) === null || _a === void 0 ? void 0 : _a.point) === null || _b === void 0 ? void 0 : _b.time;
        var u = this.plotInstance.current;
        if (u && time) {
            // Try finding left position on time axis
            var left = u.valToPos(time, 'x');
            var top_1;
            if (left) {
                // find midpoint between points at current idx
                top_1 = findMidPointYPosition(u, u.posToIdx(left));
            }
            if (!top_1 || !left) {
                return;
            }
            u.setCursor({
                left: left,
                top: top_1,
            });
        }
    };
    GraphNG.prototype.componentDidMount = function () {
        var _this = this;
        this.panelContext = this.context;
        var eventBus = this.panelContext.eventBus;
        this.subscription.add(eventBus
            .getStream(DataHoverEvent)
            .pipe(throttleTime(50))
            .subscribe({
            next: function (evt) {
                if (eventBus === evt.origin) {
                    return;
                }
                _this.handleCursorUpdate(evt);
            },
        }));
        // Legacy events (from flot graph)
        this.subscription.add(eventBus
            .getStream(LegacyGraphHoverEvent)
            .pipe(throttleTime(50))
            .subscribe({
            next: function (evt) { return _this.handleCursorUpdate(evt); },
        }));
        this.subscription.add(eventBus
            .getStream(DataHoverClearEvent)
            .pipe(throttleTime(50))
            .subscribe({
            next: function () {
                var _a;
                var u = (_a = _this.plotInstance) === null || _a === void 0 ? void 0 : _a.current;
                if (u) {
                    u.setCursor({
                        left: -10,
                        top: -10,
                    });
                }
            },
        }));
    };
    GraphNG.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.props, frames = _a.frames, structureRev = _a.structureRev, timeZone = _a.timeZone, propsToDiff = _a.propsToDiff;
        var propsChanged = !sameProps(prevProps, this.props, propsToDiff);
        if (frames !== prevProps.frames || propsChanged) {
            var newState = this.prepState(this.props, false);
            if (newState) {
                var shouldReconfig = this.state.config === undefined ||
                    timeZone !== prevProps.timeZone ||
                    structureRev !== prevProps.structureRev ||
                    !structureRev ||
                    propsChanged;
                if (shouldReconfig) {
                    newState.config = this.props.prepConfig(newState.alignedFrame, this.props.frames, this.getTimeRange);
                    newState.alignedData = newState.config.prepData([newState.alignedFrame]);
                    pluginLog('GraphNG', false, 'config recreated', newState.config);
                }
            }
            newState && this.setState(newState);
        }
    };
    GraphNG.prototype.componentWillUnmount = function () {
        this.subscription.unsubscribe();
    };
    GraphNG.prototype.render = function () {
        var _this = this;
        var _a = this.props, width = _a.width, height = _a.height, children = _a.children, timeRange = _a.timeRange, renderLegend = _a.renderLegend;
        var _b = this.state, config = _b.config, alignedFrame = _b.alignedFrame, alignedData = _b.alignedData;
        if (!config) {
            return null;
        }
        return (React.createElement(VizLayout, { width: width, height: height, legend: renderLegend(config) }, function (vizWidth, vizHeight) { return (React.createElement(UPlotChart, { config: config, data: alignedData, width: vizWidth, height: vizHeight, timeRange: timeRange, plotRef: function (u) { return (_this.plotInstance.current = u); } }, children ? children(config, alignedFrame) : null)); }));
    };
    GraphNG.contextType = PanelContextRoot;
    return GraphNG;
}(React.Component));
export { GraphNG };
//# sourceMappingURL=GraphNG.js.map