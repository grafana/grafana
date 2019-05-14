import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { VizRepeater } from '@grafana/ui';
/**
 * This is essentially a cache of processed values.  This checks for changes
 * to the source and then saves the processed values in the State
 */
var ProcessedValuesRepeater = /** @class */ (function (_super) {
    tslib_1.__extends(ProcessedValuesRepeater, _super);
    function ProcessedValuesRepeater(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {
            values: props.getProcessedValues(),
        };
        return _this;
    }
    ProcessedValuesRepeater.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.props, processFlag = _a.processFlag, source = _a.source;
        if (processFlag !== prevProps.processFlag || source !== prevProps.source) {
            this.setState({ values: this.props.getProcessedValues() });
        }
    };
    ProcessedValuesRepeater.prototype.render = function () {
        var _a = this.props, orientation = _a.orientation, height = _a.height, width = _a.width, renderValue = _a.renderValue;
        var values = this.state.values;
        return (React.createElement(VizRepeater, { height: height, width: width, values: values, orientation: orientation }, function (_a) {
            var vizHeight = _a.vizHeight, vizWidth = _a.vizWidth, value = _a.value;
            return renderValue(value, vizWidth, vizHeight);
        }));
    };
    return ProcessedValuesRepeater;
}(PureComponent));
export { ProcessedValuesRepeater };
//# sourceMappingURL=ProcessedValuesRepeater.js.map