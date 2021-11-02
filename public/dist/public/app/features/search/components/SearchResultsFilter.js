import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Button, Checkbox, stylesFactory, useTheme, HorizontalGroup } from '@grafana/ui';
import { ActionRow } from './ActionRow';
export var SearchResultsFilter = function (_a) {
    var allChecked = _a.allChecked, canDelete = _a.canDelete, canMove = _a.canMove, deleteItem = _a.deleteItem, hideLayout = _a.hideLayout, moveTo = _a.moveTo, onLayoutChange = _a.onLayoutChange, onSortChange = _a.onSortChange, onStarredFilterChange = _a.onStarredFilterChange, onTagFilterChange = _a.onTagFilterChange, onToggleAllChecked = _a.onToggleAllChecked, query = _a.query, editable = _a.editable;
    var showActions = canDelete || canMove;
    var theme = useTheme();
    var styles = getStyles(theme);
    return (React.createElement("div", { className: styles.wrapper },
        editable && (React.createElement("div", { className: styles.checkboxWrapper },
            React.createElement(Checkbox, { "aria-label": "Select all", value: allChecked, onChange: onToggleAllChecked }))),
        showActions ? (React.createElement(HorizontalGroup, { spacing: "md" },
            React.createElement(Button, { disabled: !canMove, onClick: moveTo, icon: "exchange-alt", variant: "secondary" }, "Move"),
            React.createElement(Button, { disabled: !canDelete, onClick: deleteItem, icon: "trash-alt", variant: "destructive" }, "Delete"))) : (React.createElement(ActionRow, __assign({}, {
            hideLayout: hideLayout,
            onLayoutChange: onLayoutChange,
            onSortChange: onSortChange,
            onStarredFilterChange: onStarredFilterChange,
            onTagFilterChange: onTagFilterChange,
            query: query,
        }, { showStarredFilter: true })))));
};
var getStyles = stylesFactory(function (theme) {
    var _a = theme.spacing, sm = _a.sm, md = _a.md;
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      height: ", "px;\n      display: flex;\n      justify-content: flex-start;\n      gap: ", ";\n      align-items: center;\n      margin-bottom: ", ";\n\n      > label {\n        height: 20px;\n        margin: 0 ", " 0 ", ";\n      }\n    "], ["\n      height: ", "px;\n      display: flex;\n      justify-content: flex-start;\n      gap: ", ";\n      align-items: center;\n      margin-bottom: ", ";\n\n      > label {\n        height: 20px;\n        margin: 0 ", " 0 ", ";\n      }\n    "])), theme.height.md, theme.spacing.md, sm, md, sm),
        checkboxWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label {\n        line-height: 1.2;\n        width: max-content;\n      }\n    "], ["\n      label {\n        line-height: 1.2;\n        width: max-content;\n      }\n    "]))),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=SearchResultsFilter.js.map