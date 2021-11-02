import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { IconButton } from './IconButton';
/**
 * A component used to show add & remove buttons for mutable lists of values. Wether to show or not the add or the remove buttons
 * depends on the `index` and `elements` props. This enforces a consistent experience whenever this pattern is used.
 */
export var AddRemove = function (_a) {
    var index = _a.index, onAdd = _a.onAdd, onRemove = _a.onRemove, elements = _a.elements;
    return (React.createElement("div", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        display: flex;\n      "], ["\n        display: flex;\n      "]))) },
        index === 0 && React.createElement(IconButton, { iconName: "plus", onClick: onAdd, label: "add" }),
        elements.length >= 2 && React.createElement(IconButton, { iconName: "minus", onClick: onRemove, label: "remove" })));
};
var templateObject_1;
//# sourceMappingURL=AddRemove.js.map