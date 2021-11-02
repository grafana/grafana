import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { cx, css } from '@emotion/css';
import { withTheme } from '../../themes/index';
import { getAllFields } from './logParser';
var UnThemedLogRowMessageDetectedFields = /** @class */ (function (_super) {
    __extends(UnThemedLogRowMessageDetectedFields, _super);
    function UnThemedLogRowMessageDetectedFields() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UnThemedLogRowMessageDetectedFields.prototype.render = function () {
        var _a = this.props, row = _a.row, showDetectedFields = _a.showDetectedFields, getFieldLinks = _a.getFieldLinks, wrapLogMessage = _a.wrapLogMessage;
        var fields = getAllFields(row, getFieldLinks);
        var wrapClassName = cx(wrapLogMessage && css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          white-space: pre-wrap;\n        "], ["\n          white-space: pre-wrap;\n        "]))));
        var line = showDetectedFields
            .map(function (parsedKey) {
            var field = fields.find(function (field) {
                var key = field.key;
                return key === parsedKey;
            });
            if (field) {
                return parsedKey + "=" + field.value;
            }
            return null;
        })
            .filter(function (s) { return s !== null; })
            .join(' ');
        return React.createElement("td", { className: wrapClassName }, line);
    };
    return UnThemedLogRowMessageDetectedFields;
}(PureComponent));
export var LogRowMessageDetectedFields = withTheme(UnThemedLogRowMessageDetectedFields);
LogRowMessageDetectedFields.displayName = 'LogRowMessageDetectedFields';
var templateObject_1;
//# sourceMappingURL=LogRowMessageDetectedFields.js.map