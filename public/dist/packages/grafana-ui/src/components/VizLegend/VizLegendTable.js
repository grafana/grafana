import { __makeTemplateObject, __values } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Icon } from '../Icon/Icon';
import { useStyles2 } from '../../themes/ThemeContext';
import { orderBy } from 'lodash';
import { LegendTableItem } from './VizLegendTableItem';
/**
 * @internal
 */
export var VizLegendTable = function (_a) {
    var e_1, _b, e_2, _c;
    var _d;
    var items = _a.items, sortKey = _a.sortBy, sortDesc = _a.sortDesc, itemRenderer = _a.itemRenderer, className = _a.className, onToggleSort = _a.onToggleSort, onLabelClick = _a.onLabelClick, onLabelMouseEnter = _a.onLabelMouseEnter, onLabelMouseOut = _a.onLabelMouseOut, readonly = _a.readonly;
    var styles = useStyles2(getStyles);
    var stats = {};
    try {
        for (var items_1 = __values(items), items_1_1 = items_1.next(); !items_1_1.done; items_1_1 = items_1.next()) {
            var item = items_1_1.value;
            if (item.getDisplayValues) {
                try {
                    for (var _e = (e_2 = void 0, __values(item.getDisplayValues())), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var displayValue = _f.value;
                        stats[(_d = displayValue.title) !== null && _d !== void 0 ? _d : '?'] = displayValue;
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_c = _e.return)) _c.call(_e);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (items_1_1 && !items_1_1.done && (_b = items_1.return)) _b.call(items_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var sortedItems = sortKey
        ? orderBy(items, function (item) {
            if (item.getDisplayValues) {
                var stat = item.getDisplayValues().filter(function (stat) { return stat.title === sortKey; })[0];
                return stat && stat.numeric;
            }
            return undefined;
        }, sortDesc ? 'desc' : 'asc')
        : items;
    if (!itemRenderer) {
        /* eslint-disable-next-line react/display-name */
        itemRenderer = function (item, index) { return (React.createElement(LegendTableItem, { key: item.label + "-" + index, item: item, onLabelClick: onLabelClick, onLabelMouseEnter: onLabelMouseEnter, onLabelMouseOut: onLabelMouseOut, readonly: readonly })); };
    }
    return (React.createElement("table", { className: cx(styles.table, className) },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null),
                Object.keys(stats).map(function (columnTitle) {
                    var _a;
                    var displayValue = stats[columnTitle];
                    return (React.createElement("th", { title: displayValue.description, key: columnTitle, className: cx(styles.header, onToggleSort && styles.headerSortable, (_a = {},
                            _a[styles.withIcon] = sortKey === columnTitle,
                            _a)), onClick: function () {
                            if (onToggleSort) {
                                onToggleSort(columnTitle);
                            }
                        } },
                        columnTitle,
                        sortKey === columnTitle && React.createElement(Icon, { size: "xs", name: sortDesc ? 'angle-down' : 'angle-up' })));
                }))),
        React.createElement("tbody", null, sortedItems.map(itemRenderer))));
};
var getStyles = function (theme) { return ({
    table: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 100%;\n    th:first-child {\n      width: 100%;\n      border-bottom: 1px solid ", ";\n    }\n  "], ["\n    width: 100%;\n    th:first-child {\n      width: 100%;\n      border-bottom: 1px solid ", ";\n    }\n  "])), theme.colors.border.weak),
    header: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n    font-weight: ", ";\n    border-bottom: 1px solid ", ";\n    padding: ", ";\n    font-size: ", ";\n    text-align: left;\n    white-space: nowrap;\n  "], ["\n    color: ", ";\n    font-weight: ", ";\n    border-bottom: 1px solid ", ";\n    padding: ", ";\n    font-size: ", ";\n    text-align: left;\n    white-space: nowrap;\n  "])), theme.colors.primary.text, theme.typography.fontWeightMedium, theme.colors.border.weak, theme.spacing(0.25, 2, 0.25, 1), theme.typography.bodySmall.fontSize),
    // This needs to be padding-right - icon size(xs==12) to avoid jumping
    withIcon: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    padding-right: 4px;\n  "], ["\n    padding-right: 4px;\n  "]))),
    headerSortable: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    cursor: pointer;\n  "], ["\n    cursor: pointer;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=VizLegendTable.js.map