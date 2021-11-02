import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useMemo, useState } from 'react';
import { css, cx } from '@emotion/css';
import { stylesFactory, useStyles, useTheme2 } from '../../themes';
import { Button, ClickOutsideWrapper, HorizontalGroup, IconButton, Label, VerticalGroup } from '..';
import { FilterList } from './FilterList';
import { calculateUniqueFieldValues, getFilteredOptions, valuesToOptions } from './utils';
export var FilterPopup = function (_a) {
    var _b = _a.column, preFilteredRows = _b.preFilteredRows, filterValue = _b.filterValue, setFilter = _b.setFilter, onClose = _a.onClose, field = _a.field;
    var theme = useTheme2();
    var uniqueValues = useMemo(function () { return calculateUniqueFieldValues(preFilteredRows, field); }, [preFilteredRows, field]);
    var options = useMemo(function () { return valuesToOptions(uniqueValues); }, [uniqueValues]);
    var filteredOptions = useMemo(function () { return getFilteredOptions(options, filterValue); }, [options, filterValue]);
    var _c = __read(useState(filteredOptions), 2), values = _c[0], setValues = _c[1];
    var _d = __read(useState(false), 2), matchCase = _d[0], setMatchCase = _d[1];
    var onCancel = useCallback(function (event) { return onClose(); }, [onClose]);
    var onFilter = useCallback(function (event) {
        var filtered = values.length ? values : undefined;
        setFilter(filtered);
        onClose();
    }, [setFilter, values, onClose]);
    var onClearFilter = useCallback(function (event) {
        setFilter(undefined);
        onClose();
    }, [setFilter, onClose]);
    var clearFilterVisible = useMemo(function () { return filterValue !== undefined; }, [filterValue]);
    var styles = useStyles(getStyles);
    return (React.createElement(ClickOutsideWrapper, { onClick: onCancel, useCapture: true },
        React.createElement("div", { className: cx(styles.filterContainer), onClick: stopPropagation },
            React.createElement(VerticalGroup, { spacing: "lg" },
                React.createElement(VerticalGroup, { spacing: "xs" },
                    React.createElement(HorizontalGroup, { justify: "space-between", align: "center" },
                        React.createElement(Label, { className: styles.label }, "Filter by values:"),
                        React.createElement(IconButton, { name: "text-fields", tooltip: "Match case", style: { color: matchCase ? theme.colors.text.link : theme.colors.text.disabled }, onClick: function () {
                                setMatchCase(function (s) { return !s; });
                            } })),
                    React.createElement("div", { className: cx(styles.listDivider) }),
                    React.createElement(FilterList, { onChange: setValues, values: values, options: options, caseSensitive: matchCase })),
                React.createElement(HorizontalGroup, { spacing: "lg" },
                    React.createElement(HorizontalGroup, null,
                        React.createElement(Button, { size: "sm", onClick: onFilter }, "Ok"),
                        React.createElement(Button, { size: "sm", variant: "secondary", onClick: onCancel }, "Cancel")),
                    clearFilterVisible && (React.createElement(HorizontalGroup, null,
                        React.createElement(Button, { fill: "text", size: "sm", onClick: onClearFilter }, "Clear filter"))))))));
};
var getStyles = stylesFactory(function (theme) { return ({
    filterContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: filterContainer;\n    width: 100%;\n    min-width: 250px;\n    height: 100%;\n    max-height: 400px;\n    background-color: ", ";\n    border: ", " solid ", ";\n    padding: ", ";\n    margin: ", " 0;\n    box-shadow: 0px 0px 20px ", ";\n    border-radius: ", ";\n  "], ["\n    label: filterContainer;\n    width: 100%;\n    min-width: 250px;\n    height: 100%;\n    max-height: 400px;\n    background-color: ", ";\n    border: ", " solid ", ";\n    padding: ", ";\n    margin: ", " 0;\n    box-shadow: 0px 0px 20px ", ";\n    border-radius: ", ";\n  "])), theme.colors.bg1, theme.border.width.sm, theme.colors.border2, theme.spacing.md, theme.spacing.sm, theme.colors.dropdownShadow, theme.spacing.xs),
    listDivider: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: listDivider;\n    width: 100%;\n    border-top: ", " solid ", ";\n    padding: ", " ", ";\n  "], ["\n    label: listDivider;\n    width: 100%;\n    border-top: ", " solid ", ";\n    padding: ", " ", ";\n  "])), theme.border.width.sm, theme.colors.border2, theme.spacing.xs, theme.spacing.md),
    label: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-bottom: 0;\n  "], ["\n    margin-bottom: 0;\n  "]))),
}); });
var stopPropagation = function (event) {
    event.stopPropagation();
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=FilterPopup.js.map