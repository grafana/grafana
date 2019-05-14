import * as tslib_1 from "tslib";
import React from 'react';
import { components } from '@torkelo/react-select';
import { TagBadge } from './TagBadge';
export var TagOption = function (props) {
    var data = props.data, className = props.className, label = props.label;
    return (React.createElement(components.Option, tslib_1.__assign({}, props),
        React.createElement("div", { className: "tag-filter-option btn btn-link " + (className || '') },
            React.createElement(TagBadge, { label: label, removeIcon: false, count: data.count }))));
};
export default TagOption;
//# sourceMappingURL=TagOption.js.map