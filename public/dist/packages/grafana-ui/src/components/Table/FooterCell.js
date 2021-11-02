import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
export var FooterCell = function (props) {
    var cell = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 100%;\n    list-style: none;\n  "], ["\n    width: 100%;\n    list-style: none;\n  "])));
    var list = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    width: 100%;\n    display: flex;\n    flex-direction: row;\n    justify-content: space-between;\n  "], ["\n    width: 100%;\n    display: flex;\n    flex-direction: row;\n    justify-content: space-between;\n  "])));
    if (props.value && !Array.isArray(props.value)) {
        return React.createElement("span", null, props.value);
    }
    if (props.value && Array.isArray(props.value) && props.value.length > 0) {
        return (React.createElement("ul", { className: cell }, props.value.map(function (v, i) {
            var key = Object.keys(v)[0];
            return (React.createElement("li", { className: list, key: i },
                React.createElement("span", null,
                    key,
                    ":"),
                React.createElement("span", null, v[key])));
        })));
    }
    return EmptyCell;
};
export var EmptyCell = function (props) {
    return React.createElement("span", null, "\u00A0");
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=FooterCell.js.map