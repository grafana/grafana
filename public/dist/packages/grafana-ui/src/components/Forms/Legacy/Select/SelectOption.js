import { __assign } from "tslib";
import React from 'react';
import { Icon } from '../../../Icon/Icon';
import { components } from 'react-select';
export var SelectOption = function (props) {
    var children = props.children, isSelected = props.isSelected, data = props.data;
    return (React.createElement(components.Option, __assign({}, props),
        React.createElement("div", { className: "gf-form-select-box__desc-option" },
            data.imgUrl && React.createElement("img", { className: "gf-form-select-box__desc-option__img", src: data.imgUrl }),
            React.createElement("div", { className: "gf-form-select-box__desc-option__body" },
                React.createElement("div", null, children),
                data.description && React.createElement("div", { className: "gf-form-select-box__desc-option__desc" }, data.description)),
            isSelected && React.createElement(Icon, { name: "check", "aria-hidden": "true" }))));
};
export default SelectOption;
//# sourceMappingURL=SelectOption.js.map