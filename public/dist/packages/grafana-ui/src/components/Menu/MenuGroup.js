import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { uniqueId } from 'lodash';
/** @internal */
export var MenuGroup = function (_a) {
    var label = _a.label, ariaLabel = _a.ariaLabel, children = _a.children;
    var styles = useStyles2(getStyles);
    var labelID = "group-label-" + uniqueId();
    return (React.createElement("div", { role: "group", "aria-labelledby": !ariaLabel && label ? labelID : undefined, "aria-label": ariaLabel },
        label && (React.createElement("label", { id: labelID, className: styles.groupLabel, "aria-hidden": true }, label)),
        children));
};
MenuGroup.displayName = 'MenuGroup';
/** @internal */
var getStyles = function (theme) {
    return {
        groupLabel: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      color: ", ";\n      font-size: ", ";\n      padding: ", ";\n    "], ["\n      color: ", ";\n      font-size: ", ";\n      padding: ", ";\n    "])), theme.colors.text.secondary, theme.typography.size.sm, theme.spacing(0.5, 1)),
    };
};
var templateObject_1;
//# sourceMappingURL=MenuGroup.js.map