import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { HorizontalGroup, RadioButtonGroup, stylesFactory, useTheme, Checkbox } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { SearchSrv } from 'app/core/services/search_srv';
import { SearchLayout } from '../types';
export var layoutOptions = [
    { value: SearchLayout.Folders, icon: 'folder', ariaLabel: 'View by folders' },
    { value: SearchLayout.List, icon: 'list-ul', ariaLabel: 'View as list' },
];
var searchSrv = new SearchSrv();
export var ActionRow = function (_a) {
    var _b;
    var onLayoutChange = _a.onLayoutChange, onSortChange = _a.onSortChange, _c = _a.onStarredFilterChange, onStarredFilterChange = _c === void 0 ? function () { } : _c, onTagFilterChange = _a.onTagFilterChange, query = _a.query, showStarredFilter = _a.showStarredFilter, hideLayout = _a.hideLayout;
    var theme = useTheme();
    var styles = getStyles(theme);
    return (React.createElement("div", { className: styles.actionRow },
        React.createElement("div", { className: styles.rowContainer },
            React.createElement(HorizontalGroup, { spacing: "md", width: "auto" },
                !hideLayout ? (React.createElement(RadioButtonGroup, { options: layoutOptions, onChange: onLayoutChange, value: query.layout })) : null,
                React.createElement(SortPicker, { onChange: onSortChange, value: (_b = query.sort) === null || _b === void 0 ? void 0 : _b.value }))),
        React.createElement(HorizontalGroup, { spacing: "md", width: "auto" },
            showStarredFilter && (React.createElement("div", { className: styles.checkboxWrapper },
                React.createElement(Checkbox, { label: "Filter by starred", onChange: onStarredFilterChange, value: query.starred }))),
            React.createElement(TagFilter, { isClearable: true, tags: query.tag, tagOptions: searchSrv.getDashboardTags, onChange: onTagFilterChange }))));
};
ActionRow.displayName = 'ActionRow';
var getStyles = stylesFactory(function (theme) {
    return {
        actionRow: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: none;\n\n      @media only screen and (min-width: ", ") {\n        display: flex;\n        justify-content: space-between;\n        align-items: center;\n        padding: ", " 0;\n        width: 100%;\n      }\n    "], ["\n      display: none;\n\n      @media only screen and (min-width: ", ") {\n        display: flex;\n        justify-content: space-between;\n        align-items: center;\n        padding: ", " 0;\n        width: 100%;\n      }\n    "])), theme.breakpoints.md, theme.spacing.lg),
        rowContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing.md),
        checkboxWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label {\n        line-height: 1.2;\n      }\n    "], ["\n      label {\n        line-height: 1.2;\n      }\n    "]))),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=ActionRow.js.map