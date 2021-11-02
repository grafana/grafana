import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { useLocalStorage } from 'react-use';
import { Icon, Spinner, stylesFactory, useTheme } from '@grafana/ui';
import { SearchCheckbox } from './SearchCheckbox';
import { getSectionIcon, getSectionStorageKey } from '../utils';
export var SectionHeader = function (_a) {
    var section = _a.section, onSectionClick = _a.onSectionClick, onToggleChecked = _a.onToggleChecked, _b = _a.editable, editable = _b === void 0 ? false : _b;
    var theme = useTheme();
    var styles = getSectionHeaderStyles(theme, section.selected, editable);
    var setSectionExpanded = useLocalStorage(getSectionStorageKey(section.title), true)[1];
    var onSectionExpand = function () {
        setSectionExpanded(!section.expanded);
        onSectionClick(section);
    };
    var handleCheckboxClick = useCallback(function (ev) {
        console.log('section header handleCheckboxClick');
        ev.stopPropagation();
        ev.preventDefault();
        if (onToggleChecked) {
            onToggleChecked(section);
        }
    }, [onToggleChecked, section]);
    return (React.createElement("div", { className: styles.wrapper, onClick: onSectionExpand, "aria-label": section.expanded ? "Collapse folder " + section.id : "Expand folder " + section.id },
        React.createElement(SearchCheckbox, { className: styles.checkbox, editable: editable, checked: section.checked, onClick: handleCheckboxClick, "aria-label": "Select folder" }),
        React.createElement("div", { className: styles.icon },
            React.createElement(Icon, { name: getSectionIcon(section) })),
        React.createElement("div", { className: styles.text },
            section.title,
            section.url && (React.createElement("a", { href: section.url, className: styles.link },
                React.createElement("span", { className: styles.separator }, "|"),
                " ",
                React.createElement(Icon, { name: "folder-upload" }),
                " Go to folder"))),
        section.itemsFetching ? React.createElement(Spinner, null) : React.createElement(Icon, { name: section.expanded ? 'angle-down' : 'angle-right' })));
};
var getSectionHeaderStyles = stylesFactory(function (theme, selected, editable) {
    if (selected === void 0) { selected = false; }
    var sm = theme.spacing.sm;
    return {
        wrapper: cx(css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        display: flex;\n        align-items: center;\n        font-size: ", ";\n        padding: 12px;\n        color: ", ";\n\n        &:hover,\n        &.selected {\n          color: ", ";\n        }\n\n        &:hover {\n          a {\n            opacity: 1;\n          }\n        }\n      "], ["\n        display: flex;\n        align-items: center;\n        font-size: ", ";\n        padding: 12px;\n        color: ", ";\n\n        &:hover,\n        &.selected {\n          color: ", ";\n        }\n\n        &:hover {\n          a {\n            opacity: 1;\n          }\n        }\n      "])), theme.typography.size.base, theme.colors.textWeak, theme.colors.text), 'pointer', { selected: selected }),
        checkbox: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding: 0 ", " 0 0;\n    "], ["\n      padding: 0 ", " 0 0;\n    "])), sm),
        icon: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding: 0 ", " 0 ", ";\n    "], ["\n      padding: 0 ", " 0 ", ";\n    "])), sm, editable ? 0 : sm),
        text: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      flex-grow: 1;\n      line-height: 24px;\n    "], ["\n      flex-grow: 1;\n      line-height: 24px;\n    "]))),
        link: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      padding: 2px 10px 0;\n      color: ", ";\n      opacity: 0;\n      transition: opacity 150ms ease-in-out;\n    "], ["\n      padding: 2px 10px 0;\n      color: ", ";\n      opacity: 0;\n      transition: opacity 150ms ease-in-out;\n    "])), theme.colors.textWeak),
        separator: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      margin-right: 6px;\n    "], ["\n      margin-right: 6px;\n    "]))),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=SectionHeader.js.map