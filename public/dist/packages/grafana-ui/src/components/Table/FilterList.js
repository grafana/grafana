import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { css } from '@emotion/css';
import { stylesFactory, useTheme2 } from '../../themes';
import { Checkbox, FilterInput, Label, VerticalGroup } from '..';
var ITEM_HEIGHT = 28;
var MIN_HEIGHT = ITEM_HEIGHT * 5;
export var FilterList = function (_a) {
    var options = _a.options, values = _a.values, caseSensitive = _a.caseSensitive, onChange = _a.onChange;
    var theme = useTheme2();
    var styles = getStyles(theme);
    var _b = __read(useState(''), 2), searchFilter = _b[0], setSearchFilter = _b[1];
    var regex = useMemo(function () { return new RegExp(searchFilter, caseSensitive ? undefined : 'i'); }, [searchFilter, caseSensitive]);
    var items = useMemo(function () {
        return options.filter(function (option) {
            if (option.label === undefined) {
                return false;
            }
            return regex.test(option.label);
        });
    }, [options, regex]);
    var gutter = theme.spacing.gridSize;
    var height = useMemo(function () { return Math.min(items.length * ITEM_HEIGHT, MIN_HEIGHT) + gutter; }, [gutter, items.length]);
    var onInputChange = useCallback(function (v) {
        setSearchFilter(v);
    }, [setSearchFilter]);
    var onCheckedChanged = useCallback(function (option) { return function (event) {
        var newValues = event.currentTarget.checked
            ? values.concat(option)
            : values.filter(function (c) { return c.value !== option.value; });
        onChange(newValues);
    }; }, [onChange, values]);
    return (React.createElement(VerticalGroup, { spacing: "md" },
        React.createElement(FilterInput, { placeholder: "Filter values", onChange: onInputChange, value: searchFilter }),
        !items.length && React.createElement(Label, null, "No values"),
        items.length && (React.createElement(List, { height: height, itemCount: items.length, itemSize: ITEM_HEIGHT, width: "100%", className: styles.filterList }, function (_a) {
            var index = _a.index, style = _a.style;
            var option = items[index];
            var value = option.value, label = option.label;
            var isChecked = values.find(function (s) { return s.value === value; }) !== undefined;
            return (React.createElement("div", { className: styles.filterListRow, style: style, title: label },
                React.createElement(Checkbox, { value: isChecked, label: label, onChange: onCheckedChanged(option) })));
        }))));
};
var getStyles = stylesFactory(function (theme) { return ({
    filterList: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: filterList;\n  "], ["\n    label: filterList;\n  "]))),
    filterListRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: filterListRow;\n    cursor: pointer;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    padding: ", ";\n\n    :hover {\n      background-color: ", ";\n    }\n  "], ["\n    label: filterListRow;\n    cursor: pointer;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    padding: ", ";\n\n    :hover {\n      background-color: ", ";\n    }\n  "])), theme.spacing(0.5), theme.colors.action.hover),
}); });
var templateObject_1, templateObject_2;
//# sourceMappingURL=FilterList.js.map