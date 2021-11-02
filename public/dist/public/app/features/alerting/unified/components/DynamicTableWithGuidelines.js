import { __assign, __makeTemplateObject, __rest } from "tslib";
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { DynamicTable } from './DynamicTable';
// DynamicTable, but renders visual guidelines on the left, for larger screen widths
export var DynamicTableWithGuidelines = function (_a) {
    var renderExpandedContent = _a.renderExpandedContent, props = __rest(_a, ["renderExpandedContent"]);
    var styles = useStyles2(getStyles);
    return (React.createElement(DynamicTable, __assign({ renderExpandedContent: renderExpandedContent
            ? function (item, index, items) { return (React.createElement(React.Fragment, null,
                !(index === items.length - 1) && React.createElement("div", { className: cx(styles.contentGuideline, styles.guideline) }),
                renderExpandedContent(item, index, items))); }
            : undefined, renderPrefixHeader: function () { return (React.createElement("div", { className: styles.relative },
            React.createElement("div", { className: cx(styles.headerGuideline, styles.guideline) }))); }, renderPrefixCell: function (_, index, items) { return (React.createElement("div", { className: styles.relative },
            React.createElement("div", { className: cx(styles.topGuideline, styles.guideline) }),
            !(index === items.length - 1) && React.createElement("div", { className: cx(styles.bottomGuideline, styles.guideline) }))); } }, props)));
};
export var getStyles = function (theme) { return ({
    relative: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    position: relative;\n    height: 100%;\n  "], ["\n    position: relative;\n    height: 100%;\n  "]))),
    guideline: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    left: -19px;\n    border-left: 1px solid ", ";\n    position: absolute;\n\n    ", " {\n      display: none;\n    }\n  "], ["\n    left: -19px;\n    border-left: 1px solid ", ";\n    position: absolute;\n\n    ", " {\n      display: none;\n    }\n  "])), theme.colors.border.medium, theme.breakpoints.down('md')),
    topGuideline: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: 18px;\n    border-bottom: 1px solid ", ";\n    top: 0;\n    bottom: 50%;\n  "], ["\n    width: 18px;\n    border-bottom: 1px solid ", ";\n    top: 0;\n    bottom: 50%;\n  "])), theme.colors.border.medium),
    bottomGuideline: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    top: 50%;\n    bottom: 0;\n  "], ["\n    top: 50%;\n    bottom: 0;\n  "]))),
    contentGuideline: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    top: 0;\n    bottom: 0;\n    left: -49px !important;\n  "], ["\n    top: 0;\n    bottom: 0;\n    left: -49px !important;\n  "]))),
    headerGuideline: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    top: -25px;\n    bottom: 0;\n  "], ["\n    top: -25px;\n    bottom: 0;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=DynamicTableWithGuidelines.js.map