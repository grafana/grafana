import { __assign, __extends } from "tslib";
import React from 'react';
import { GraphNG } from '../GraphNG/GraphNG';
import { PlotLegend } from '../uPlot/PlotLegend';
import { LegendDisplayMode } from '@grafana/schema';
import { preparePlotConfigBuilder } from './utils';
import { withTheme2 } from '../../themes/ThemeContext';
import { PanelContextRoot } from '../PanelChrome/PanelContext';
var propsToDiff = ['legend'];
var UnthemedTimeSeries = /** @class */ (function (_super) {
    __extends(UnthemedTimeSeries, _super);
    function UnthemedTimeSeries() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.panelContext = {};
        _this.prepConfig = function (alignedFrame, allFrames, getTimeRange) {
            var _a = _this.context, eventBus = _a.eventBus, sync = _a.sync;
            var _b = _this.props, theme = _b.theme, timeZone = _b.timeZone, legend = _b.legend;
            return preparePlotConfigBuilder({
                frame: alignedFrame,
                theme: theme,
                timeZone: timeZone,
                getTimeRange: getTimeRange,
                eventBus: eventBus,
                sync: sync,
                allFrames: allFrames,
                legend: legend,
            });
        };
        _this.renderLegend = function (config) {
            var _a = _this.props, legend = _a.legend, frames = _a.frames;
            if (!config || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
                return null;
            }
            return React.createElement(PlotLegend, __assign({ data: frames, config: config }, legend));
        };
        return _this;
    }
    UnthemedTimeSeries.prototype.render = function () {
        return (React.createElement(GraphNG, __assign({}, this.props, { prepConfig: this.prepConfig, propsToDiff: propsToDiff, renderLegend: this.renderLegend })));
    };
    UnthemedTimeSeries.contextType = PanelContextRoot;
    return UnthemedTimeSeries;
}(React.Component));
export { UnthemedTimeSeries };
export var TimeSeries = withTheme2(UnthemedTimeSeries);
TimeSeries.displayName = 'TimeSeries';
//# sourceMappingURL=TimeSeries.js.map