import { __assign, __makeTemplateObject, __rest } from "tslib";
import { css, cx } from '@emotion/css';
import { groupBy, capitalize } from 'lodash';
import React, { useRef, useMemo } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { List } from '../index';
import { useStyles2 } from '../../themes';
var getStyles = function (theme) {
    return {
        list: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      border-bottom: 1px solid ", ";\n      &:last-child {\n        border: none;\n      }\n    "], ["\n      border-bottom: 1px solid ", ";\n      &:last-child {\n        border: none;\n      }\n    "])), theme.colors.border.weak),
        wrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      background: ", ";\n      width: 250px;\n    "], ["\n      background: ", ";\n      width: 250px;\n    "])), theme.colors.background.primary),
        item: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      background: none;\n      padding: 2px 8px;\n      color: ", ";\n      cursor: pointer;\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      background: none;\n      padding: 2px 8px;\n      color: ", ";\n      cursor: pointer;\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.colors.text.primary, theme.colors.action.hover),
        label: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.text.secondary),
        activeItem: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      background: ", ";\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      background: ", ";\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.colors.background.secondary, theme.colors.background.secondary),
        itemValue: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      font-family: ", ";\n      font-size: ", ";\n    "], ["\n      font-family: ", ";\n      font-size: ", ";\n    "])), theme.typography.fontFamilyMonospace, theme.typography.size.sm),
    };
};
export var DataLinkSuggestions = function (_a) {
    var suggestions = _a.suggestions, otherProps = __rest(_a, ["suggestions"]);
    var ref = useRef(null);
    useClickAway(ref, function () {
        if (otherProps.onClose) {
            otherProps.onClose();
        }
    });
    var groupedSuggestions = useMemo(function () {
        return groupBy(suggestions, function (s) { return s.origin; });
    }, [suggestions]);
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { ref: ref, className: styles.wrapper }, Object.keys(groupedSuggestions).map(function (key, i) {
        var indexOffset = i === 0
            ? 0
            : Object.keys(groupedSuggestions).reduce(function (acc, current, index) {
                if (index >= i) {
                    return acc;
                }
                return acc + groupedSuggestions[current].length;
            }, 0);
        return (React.createElement(DataLinkSuggestionsList, __assign({}, otherProps, { suggestions: groupedSuggestions[key], label: "" + capitalize(key), activeIndex: otherProps.activeIndex, activeIndexOffset: indexOffset, key: key })));
    })));
};
DataLinkSuggestions.displayName = 'DataLinkSuggestions';
var DataLinkSuggestionsList = React.memo(function (_a) {
    var activeIndex = _a.activeIndex, activeIndexOffset = _a.activeIndexOffset, label = _a.label, onClose = _a.onClose, onSuggestionSelect = _a.onSuggestionSelect, suggestions = _a.suggestions, selectedRef = _a.activeRef;
    var styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement(List, { className: styles.list, items: suggestions, renderItem: function (item, index) {
                var isActive = index + activeIndexOffset === activeIndex;
                return (React.createElement("div", { className: cx(styles.item, isActive && styles.activeItem), ref: isActive ? selectedRef : undefined, onClick: function () {
                        onSuggestionSelect(item);
                    }, title: item.documentation },
                    React.createElement("span", { className: styles.itemValue },
                        React.createElement("span", { className: styles.label }, label),
                        " ",
                        item.label)));
            } })));
});
DataLinkSuggestionsList.displayName = 'DataLinkSuggestionsList';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=DataLinkSuggestions.js.map