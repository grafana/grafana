import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { Icon } from '../Icon/Icon';
import { css, cx } from '@emotion/css';
// @ts-ignore
import RCCascader from 'rc-cascader';
import { onChangeCascader, onLoadDataCascader } from '../Cascader/optionMappings';
import { stylesFactory, useTheme2 } from '../../themes';
var getStyles = stylesFactory(function (theme) {
    return {
        popup: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: popup;\n      z-index: ", ";\n    "], ["\n      label: popup;\n      z-index: ", ";\n    "])), theme.zIndex.dropdown),
        icons: {
            right: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        margin: 1px 0 0 4px;\n      "], ["\n        margin: 1px 0 0 4px;\n      "]))),
            left: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        margin: -1px 4px 0 0;\n      "], ["\n        margin: -1px 4px 0 0;\n      "]))),
        },
    };
});
export var ButtonCascader = function (props) {
    var onChange = props.onChange, className = props.className, loadData = props.loadData, icon = props.icon, rest = __rest(props, ["onChange", "className", "loadData", "icon"]);
    var theme = useTheme2();
    var styles = getStyles(theme);
    return (React.createElement(RCCascader, __assign({ onChange: onChangeCascader(onChange), loadData: onLoadDataCascader(loadData), popupClassName: styles.popup }, rest, { expandIcon: null }),
        React.createElement("button", { className: cx('gf-form-label', className), disabled: props.disabled },
            icon && React.createElement(Icon, { name: icon, className: styles.icons.left }),
            props.children,
            React.createElement(Icon, { name: "angle-down", className: styles.icons.right }))));
};
ButtonCascader.displayName = 'ButtonCascader';
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=ButtonCascader.js.map