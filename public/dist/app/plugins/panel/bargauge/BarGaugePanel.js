import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Services & Utils
import { BarGauge } from '@grafana/ui';
import { config } from 'app/core/config';
import { getSingleStatValues } from '../singlestat2/SingleStatPanel';
import { ProcessedValuesRepeater } from '../singlestat2/ProcessedValuesRepeater';
var BarGaugePanel = /** @class */ (function (_super) {
    tslib_1.__extends(BarGaugePanel, _super);
    function BarGaugePanel() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.renderValue = function (value, width, height) {
            var options = _this.props.options;
            return (React.createElement(BarGauge, { value: value, width: width, height: height, orientation: options.orientation, thresholds: options.thresholds, theme: config.theme }));
        };
        _this.getProcessedValues = function () {
            return getSingleStatValues(_this.props);
        };
        return _this;
    }
    BarGaugePanel.prototype.render = function () {
        var _a = this.props, height = _a.height, width = _a.width, options = _a.options, panelData = _a.panelData;
        var orientation = options.orientation;
        return (React.createElement(ProcessedValuesRepeater, { getProcessedValues: this.getProcessedValues, renderValue: this.renderValue, width: width, height: height, source: panelData, orientation: orientation }));
    };
    return BarGaugePanel;
}(PureComponent));
export { BarGaugePanel };
//# sourceMappingURL=BarGaugePanel.js.map