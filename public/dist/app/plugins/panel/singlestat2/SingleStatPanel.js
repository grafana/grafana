import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { processSingleStatPanelData } from '@grafana/ui';
import { config } from 'app/core/config';
import { getDisplayProcessor } from '@grafana/ui';
import { ProcessedValuesRepeater } from './ProcessedValuesRepeater';
export var getSingleStatValues = function (props) {
    var panelData = props.panelData, replaceVariables = props.replaceVariables, options = props.options;
    var valueOptions = options.valueOptions, valueMappings = options.valueMappings;
    var processor = getDisplayProcessor({
        unit: valueOptions.unit,
        decimals: valueOptions.decimals,
        mappings: valueMappings,
        thresholds: options.thresholds,
        prefix: replaceVariables(valueOptions.prefix),
        suffix: replaceVariables(valueOptions.suffix),
        theme: config.theme,
    });
    return processSingleStatPanelData({
        panelData: panelData,
        stat: valueOptions.stat,
    }).map(function (stat) { return processor(stat.value); });
};
var SingleStatPanel = /** @class */ (function (_super) {
    tslib_1.__extends(SingleStatPanel, _super);
    function SingleStatPanel() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.renderValue = function (value, width, height) {
            var style = {};
            style.margin = '0 auto';
            style.fontSize = '250%';
            style.textAlign = 'center';
            if (value.color) {
                style.color = value.color;
            }
            return (React.createElement("div", { style: { width: width, height: height } },
                React.createElement("div", { style: style }, value.text)));
        };
        _this.getProcessedValues = function () {
            return getSingleStatValues(_this.props);
        };
        return _this;
    }
    SingleStatPanel.prototype.render = function () {
        var _a = this.props, height = _a.height, width = _a.width, options = _a.options, panelData = _a.panelData;
        var orientation = options.orientation;
        return (React.createElement(ProcessedValuesRepeater, { getProcessedValues: this.getProcessedValues, renderValue: this.renderValue, width: width, height: height, source: panelData, orientation: orientation }));
    };
    return SingleStatPanel;
}(PureComponent));
export { SingleStatPanel };
//# sourceMappingURL=SingleStatPanel.js.map