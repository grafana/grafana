import { __assign, __rest } from "tslib";
import React from 'react';
import classNames from 'classnames';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
export var FormLabel = function (_a) {
    var children = _a.children, isFocused = _a.isFocused, isInvalid = _a.isInvalid, className = _a.className, htmlFor = _a.htmlFor, tooltip = _a.tooltip, width = _a.width, rest = __rest(_a, ["children", "isFocused", "isInvalid", "className", "htmlFor", "tooltip", "width"]);
    var classes = classNames(className, "gf-form-label width-" + (width ? width : '10'), {
        'gf-form-label--is-focused': isFocused,
        'gf-form-label--is-invalid': isInvalid,
    });
    return (React.createElement("label", __assign({ className: classes }, rest, { htmlFor: htmlFor }),
        children,
        tooltip && (React.createElement(Tooltip, { placement: "top", content: tooltip, theme: 'info' },
            React.createElement("div", { className: "gf-form-help-icon gf-form-help-icon--right-normal" },
                React.createElement(Icon, { name: "info-circle", size: "sm", style: { marginLeft: '10px' } }))))));
};
export var InlineFormLabel = FormLabel;
//# sourceMappingURL=FormLabel.js.map