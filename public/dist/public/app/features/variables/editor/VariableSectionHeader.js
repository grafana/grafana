import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
export function VariableSectionHeader(_a) {
    var name = _a.name;
    var styles = useStyles(getStyles);
    return React.createElement("h5", { className: styles.sectionHeading }, name);
}
function getStyles(theme) {
    return {
        sectionHeading: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: sectionHeading;\n      font-size: ", ";\n      margin-bottom: ", ";\n    "], ["\n      label: sectionHeading;\n      font-size: ", ";\n      margin-bottom: ", ";\n    "])), theme.typography.size.md, theme.spacing.sm),
    };
}
var templateObject_1;
//# sourceMappingURL=VariableSectionHeader.js.map