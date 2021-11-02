import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { IconButton, useStyles2 } from '@grafana/ui';
export var CloseButton = function (_a) {
    var onClick = _a.onClick, ariaLabel = _a["aria-label"];
    var styles = useStyles2(getStyles);
    return React.createElement(IconButton, { "aria-label": ariaLabel !== null && ariaLabel !== void 0 ? ariaLabel : 'Close', className: styles, name: "times", onClick: onClick });
};
var getStyles = function (theme) {
    return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    position: absolute;\n    right: ", ";\n    top: ", ";\n  "], ["\n    position: absolute;\n    right: ", ";\n    top: ", ";\n  "])), theme.spacing(0.5), theme.spacing(1));
};
var templateObject_1;
//# sourceMappingURL=CloseButton.js.map