import { __read, __values } from "tslib";
import memoizeOne from 'memoize-one';
import { FieldType, formattedValueToString, getFieldDisplayName, } from '@grafana/data';
import { DefaultCell } from './DefaultCell';
import { BarGaugeCell } from './BarGaugeCell';
import { TableCellDisplayMode } from './types';
import { JSONViewCell } from './JSONViewCell';
import { ImageCell } from './ImageCell';
import { getFooterValue } from './FooterRow';
export function getTextAlign(field) {
    if (!field) {
        return 'flex-start';
    }
    if (field.config.custom) {
        var custom = field.config.custom;
        switch (custom.align) {
            case 'right':
                return 'flex-end';
            case 'left':
                return 'flex-start';
            case 'center':
                return 'center';
        }
    }
    if (field.type === FieldType.number) {
        return 'flex-end';
    }
    return 'flex-start';
}
export function getColumns(data, availableWidth, columnMinWidth, footerValues) {
    var e_1, _a, e_2, _b, e_3, _c;
    var columns = [];
    var fieldCountWithoutWidth = data.fields.length;
    var _loop_1 = function (fieldIndex, field) {
        var fieldTableOptions = (field.config.custom || {});
        if (fieldTableOptions.hidden) {
            return "continue";
        }
        if (fieldTableOptions.width) {
            availableWidth -= fieldTableOptions.width;
            fieldCountWithoutWidth -= 1;
        }
        var selectSortType = function (type) {
            switch (type) {
                case FieldType.number:
                    return 'number';
                case FieldType.time:
                    return 'basic';
                default:
                    return 'alphanumeric-insensitive';
            }
        };
        var Cell = getCellComponent(fieldTableOptions.displayMode, field);
        columns.push({
            Cell: Cell,
            id: fieldIndex.toString(),
            Header: getFieldDisplayName(field, data),
            accessor: function (row, i) {
                return field.values.get(i);
            },
            sortType: selectSortType(field.type),
            width: fieldTableOptions.width,
            minWidth: fieldTableOptions.minWidth || columnMinWidth,
            filter: memoizeOne(filterByValue(field)),
            justifyContent: getTextAlign(field),
            Footer: getFooterValue(fieldIndex, footerValues),
        });
    };
    try {
        for (var _d = __values(data.fields.entries()), _e = _d.next(); !_e.done; _e = _d.next()) {
            var _f = __read(_e.value, 2), fieldIndex = _f[0], field = _f[1];
            _loop_1(fieldIndex, field);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
        }
        finally { if (e_1) throw e_1.error; }
    }
    // set columns that are at minimum width
    var sharedWidth = availableWidth / fieldCountWithoutWidth;
    for (var i = fieldCountWithoutWidth; i > 0; i--) {
        try {
            for (var columns_1 = (e_2 = void 0, __values(columns)), columns_1_1 = columns_1.next(); !columns_1_1.done; columns_1_1 = columns_1.next()) {
                var column = columns_1_1.value;
                if (!column.width && column.minWidth > sharedWidth) {
                    column.width = column.minWidth;
                    availableWidth -= column.width;
                    fieldCountWithoutWidth -= 1;
                    sharedWidth = availableWidth / fieldCountWithoutWidth;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (columns_1_1 && !columns_1_1.done && (_b = columns_1.return)) _b.call(columns_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    try {
        // divide up the rest of the space
        for (var columns_2 = __values(columns), columns_2_1 = columns_2.next(); !columns_2_1.done; columns_2_1 = columns_2.next()) {
            var column = columns_2_1.value;
            if (!column.width) {
                column.width = sharedWidth;
            }
            column.minWidth = 50;
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (columns_2_1 && !columns_2_1.done && (_c = columns_2.return)) _c.call(columns_2);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return columns;
}
function getCellComponent(displayMode, field) {
    switch (displayMode) {
        case TableCellDisplayMode.ColorText:
        case TableCellDisplayMode.ColorBackground:
            return DefaultCell;
        case TableCellDisplayMode.Image:
            return ImageCell;
        case TableCellDisplayMode.LcdGauge:
        case TableCellDisplayMode.BasicGauge:
        case TableCellDisplayMode.GradientGauge:
            return BarGaugeCell;
        case TableCellDisplayMode.JSONView:
            return JSONViewCell;
    }
    // Default or Auto
    if (field.type === FieldType.other) {
        return JSONViewCell;
    }
    return DefaultCell;
}
export function filterByValue(field) {
    return function (rows, id, filterValues) {
        if (rows.length === 0) {
            return rows;
        }
        if (!filterValues) {
            return rows;
        }
        if (!field) {
            return rows;
        }
        return rows.filter(function (row) {
            if (!row.values.hasOwnProperty(id)) {
                return false;
            }
            var value = rowToFieldValue(row, field);
            return filterValues.find(function (filter) { return filter.value === value; }) !== undefined;
        });
    };
}
export function calculateUniqueFieldValues(rows, field) {
    if (!field || rows.length === 0) {
        return {};
    }
    var set = {};
    for (var index = 0; index < rows.length; index++) {
        var value = rowToFieldValue(rows[index], field);
        set[value || '(Blanks)'] = value;
    }
    return set;
}
export function rowToFieldValue(row, field) {
    if (!field || !row) {
        return '';
    }
    var fieldValue = field.values.get(row.index);
    var displayValue = field.display ? field.display(fieldValue) : fieldValue;
    var value = field.display ? formattedValueToString(displayValue) : displayValue;
    return value;
}
export function valuesToOptions(unique) {
    return Object.keys(unique)
        .reduce(function (all, key) { return all.concat({ value: unique[key], label: key }); }, [])
        .sort(sortOptions);
}
export function sortOptions(a, b) {
    if (a.label === undefined && b.label === undefined) {
        return 0;
    }
    if (a.label === undefined && b.label !== undefined) {
        return -1;
    }
    if (a.label !== undefined && b.label === undefined) {
        return 1;
    }
    if (a.label < b.label) {
        return -1;
    }
    if (a.label > b.label) {
        return 1;
    }
    return 0;
}
export function getFilteredOptions(options, filterValues) {
    if (!filterValues) {
        return [];
    }
    return options.filter(function (option) { return filterValues.some(function (filtered) { return filtered.value === option.value; }); });
}
export function sortCaseInsensitive(a, b, id) {
    return String(a.values[id]).localeCompare(String(b.values[id]), undefined, { sensitivity: 'base' });
}
// sortNumber needs to have great performance as it is called a lot
export function sortNumber(rowA, rowB, id) {
    var a = toNumber(rowA.values[id]);
    var b = toNumber(rowB.values[id]);
    return a === b ? 0 : a > b ? 1 : -1;
}
function toNumber(value) {
    if (value === null || value === undefined || value === '' || isNaN(value)) {
        return Number.NEGATIVE_INFINITY;
    }
    if (typeof value === 'number') {
        return value;
    }
    return Number(value);
}
//# sourceMappingURL=utils.js.map