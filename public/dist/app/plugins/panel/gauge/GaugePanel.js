import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Services & Utils
import { config } from 'app/core/config';
// Components
import { Gauge } from '@grafana/ui';
import { getSingleStatValues } from '../singlestat2/SingleStatPanel';
import { ProcessedValuesRepeater } from '../singlestat2/ProcessedValuesRepeater';
var GaugePanel = /** @class */ (function (_super) {
    tslib_1.__extends(GaugePanel, _super);
    function GaugePanel() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.renderValue = function (value, width, height) {
            var options = _this.props.options;
            return (React.createElement(Gauge, { value: value, width: width, height: height, thresholds: options.thresholds, showThresholdLabels: options.showThresholdLabels, showThresholdMarkers: options.showThresholdMarkers, minValue: options.minValue, maxValue: options.maxValue, theme: config.theme }));
        };
        _this.getProcessedValues = function () {
            return getSingleStatValues(_this.props);
        };
        return _this;
    }
    GaugePanel.prototype.render = function () {
        var _a = this.props, height = _a.height, width = _a.width, options = _a.options, panelData = _a.panelData;
        var orientation = options.orientation;
        return (React.createElement(ProcessedValuesRepeater, { getProcessedValues: this.getProcessedValues, renderValue: this.renderValue, width: width, height: height, source: panelData, orientation: orientation }));
    };
    return GaugePanel;
}(PureComponent));
export { GaugePanel };
//# sourceMappingURL=GaugePanel.js.map