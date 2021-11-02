import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { InlineLabel } from '../Forms/InlineLabel';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
/**
 * Horizontal section for editor components.
 *
 * @alpha
 */
export var SegmentSection = function (_a) {
    var label = _a.label, children = _a.children, fill = _a.fill;
    var styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineLabel, { width: 12, className: styles.label }, label),
            children,
            fill && (React.createElement("div", { className: styles.fill },
                React.createElement(InlineLabel, null, ''))))));
};
var getStyles = function (theme) { return ({
    label: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.primary.text),
    fill: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    flex-grow: 1;\n    margin-bottom: ", ";\n  "], ["\n    flex-grow: 1;\n    margin-bottom: ", ";\n  "])), theme.spacing(0.5)),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=SegmentSection.js.map