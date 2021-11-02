import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { Button, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
export var ListNewButton = function (_a) {
    var children = _a.children, restProps = __rest(_a, ["children"]);
    var styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.buttonWrapper },
        React.createElement(Button, __assign({ icon: "plus", variant: "secondary" }, restProps), children)));
};
var getStyles = function (theme) { return ({
    buttonWrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: ", " 0;\n  "], ["\n    padding: ", " 0;\n  "])), theme.spacing.lg),
}); };
var templateObject_1;
//# sourceMappingURL=ListNewButton.js.map