import { __assign } from "tslib";
import React from 'react';
import { useTheme2 } from '../../themes';
import { getSelectStyles } from './getSelectStyles';
import { Icon } from '../Icon/Icon';
export var MultiValueContainer = function (_a) {
    var innerProps = _a.innerProps, children = _a.children;
    var theme = useTheme2();
    var styles = getSelectStyles(theme);
    return (React.createElement("div", __assign({}, innerProps, { className: styles.multiValueContainer }), children));
};
export var MultiValueRemove = function (_a) {
    var children = _a.children, innerProps = _a.innerProps;
    var theme = useTheme2();
    var styles = getSelectStyles(theme);
    return (React.createElement("div", __assign({}, innerProps, { className: styles.multiValueRemove }),
        React.createElement(Icon, { name: "times", size: "sm" })));
};
//# sourceMappingURL=MultiValue.js.map