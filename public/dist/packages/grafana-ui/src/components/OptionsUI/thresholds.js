import { __extends } from "tslib";
import React from 'react';
import { ThresholdsMode } from '@grafana/data';
import { ThresholdsEditor } from '../ThresholdsEditorNew/ThresholdsEditor';
var ThresholdsValueEditor = /** @class */ (function (_super) {
    __extends(ThresholdsValueEditor, _super);
    function ThresholdsValueEditor(props) {
        return _super.call(this, props) || this;
    }
    ThresholdsValueEditor.prototype.render = function () {
        var onChange = this.props.onChange;
        var value = this.props.value;
        if (!value) {
            value = {
                mode: ThresholdsMode.Percentage,
                // Must be sorted by 'value', first value is always -Infinity
                steps: [
                // anything?
                ],
            };
        }
        return React.createElement(ThresholdsEditor, { thresholds: value, onChange: onChange });
    };
    return ThresholdsValueEditor;
}(React.PureComponent));
export { ThresholdsValueEditor };
//# sourceMappingURL=thresholds.js.map