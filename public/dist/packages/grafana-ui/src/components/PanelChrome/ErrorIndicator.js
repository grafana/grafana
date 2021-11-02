import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { useStyles } from '../../themes';
/**
 * @internal
 */
export var ErrorIndicator = function (_a) {
    var _b;
    var error = _a.error, onClick = _a.onClick;
    var styles = useStyles(getStyles);
    if (!error) {
        return null;
    }
    return (React.createElement(Tooltip, { theme: "error", content: error },
        React.createElement(Icon, { onClick: onClick, className: cx(styles.icon, (_b = {}, _b[styles.clickable] = !!onClick, _b)), size: "sm", name: "exclamation-triangle" })));
};
var getStyles = function (theme) {
    return {
        clickable: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      cursor: pointer;\n    "], ["\n      cursor: pointer;\n    "]))),
        icon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.palette.red88),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=ErrorIndicator.js.map