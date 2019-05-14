import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
// Utils
import { processTimeSeries } from '@grafana/ui/src/utils';
// Components
import { Graph } from '@grafana/ui';
// Types
import { NullValueMode } from '@grafana/ui/src/types';
var GraphPanel = /** @class */ (function (_super) {
    tslib_1.__extends(GraphPanel, _super);
    function GraphPanel() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    GraphPanel.prototype.render = function () {
        var _a = this.props, panelData = _a.panelData, timeRange = _a.timeRange, width = _a.width, height = _a.height;
        var _b = this.props.options, showLines = _b.showLines, showBars = _b.showBars, showPoints = _b.showPoints;
        var vmSeries;
        if (panelData.timeSeries) {
            vmSeries = processTimeSeries({
                timeSeries: panelData.timeSeries,
                nullValueMode: NullValueMode.Ignore,
            });
        }
        return (React.createElement(Graph, { timeSeries: vmSeries, timeRange: timeRange, showLines: showLines, showPoints: showPoints, showBars: showBars, width: width, height: height }));
    };
    return GraphPanel;
}(PureComponent));
export { GraphPanel };
//# sourceMappingURL=GraphPanel.js.map