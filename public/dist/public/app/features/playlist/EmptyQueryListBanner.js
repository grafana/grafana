import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
export var EmptyQueryListBanner = function () {
    var styles = useStyles2(getStyles);
    return React.createElement("div", { className: styles.noResult }, "No playlist found!");
};
var getStyles = function (theme) {
    return {
        noResult: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: ", ";\n      background: ", ";\n      font-style: italic;\n      margin-top: ", ";\n    "], ["\n      padding: ", ";\n      background: ", ";\n      font-style: italic;\n      margin-top: ", ";\n    "])), theme.spacing(2), theme.colors.secondary.main, theme.spacing(2)),
    };
};
var templateObject_1;
//# sourceMappingURL=EmptyQueryListBanner.js.map