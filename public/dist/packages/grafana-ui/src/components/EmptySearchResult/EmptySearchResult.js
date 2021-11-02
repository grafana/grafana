import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
var EmptySearchResult = function (_a) {
    var children = _a.children;
    var styles = useStyles2(getStyles);
    return React.createElement("div", { className: styles.container }, children);
};
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      border-left: 3px solid ", ";\n      background-color: ", ";\n      padding: ", ";\n      min-width: 350px;\n      border-radius: ", ";\n      margin-bottom: ", ";\n    "], ["\n      border-left: 3px solid ", ";\n      background-color: ", ";\n      padding: ", ";\n      min-width: 350px;\n      border-radius: ", ";\n      margin-bottom: ", ";\n    "])), theme.colors.info.main, theme.colors.background.secondary, theme.spacing(2), theme.shape.borderRadius(2), theme.spacing(4)),
    };
};
export { EmptySearchResult };
var templateObject_1;
//# sourceMappingURL=EmptySearchResult.js.map