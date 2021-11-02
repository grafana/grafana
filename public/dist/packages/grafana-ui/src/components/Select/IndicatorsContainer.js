import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useTheme2 } from '../../themes/ThemeContext';
import { getInputStyles } from '../Input/Input';
import { cx, css } from '@emotion/css';
export var IndicatorsContainer = React.forwardRef(function (props, ref) {
    var children = props.children;
    var theme = useTheme2();
    var styles = getInputStyles({ theme: theme, invalid: false });
    return (React.createElement("div", { className: cx(styles.suffix, css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          position: relative;\n        "], ["\n          position: relative;\n        "])))), ref: ref }, children));
});
var templateObject_1;
//# sourceMappingURL=IndicatorsContainer.js.map