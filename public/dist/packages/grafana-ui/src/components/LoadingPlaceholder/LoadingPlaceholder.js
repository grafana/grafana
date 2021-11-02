import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Spinner } from '../Spinner/Spinner';
import { useStyles } from '../../themes';
/**
 * @public
 */
export var LoadingPlaceholder = function (_a) {
    var text = _a.text, className = _a.className, rest = __rest(_a, ["text", "className"]);
    var styles = useStyles(getStyles);
    return (React.createElement("div", __assign({ className: cx(styles.container, className) }, rest),
        text,
        " ",
        React.createElement(Spinner, { inline: true })));
};
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.xl),
    };
};
var templateObject_1;
//# sourceMappingURL=LoadingPlaceholder.js.map