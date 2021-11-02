import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
export var Page = function (_a) {
    var children = _a.children;
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: "page-container" },
        React.createElement("div", { className: styles }, children)));
};
var getStyles = function (theme) {
    return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing(3));
};
var templateObject_1;
//# sourceMappingURL=Page.js.map