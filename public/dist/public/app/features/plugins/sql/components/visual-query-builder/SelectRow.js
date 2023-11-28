import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useCallback } from 'react';
import { toOption } from '@grafana/data';
import { EditorField, Stack } from '@grafana/experimental';
import { Button, Select, useStyles2 } from '@grafana/ui';
import { QueryEditorExpressionType } from '../../expressions';
import { QueryFormat } from '../../types';
import { createFunctionField } from '../../utils/sql.utils';
const asteriskValue = { label: '*', value: '*' };
export function SelectRow({ sql, format, columns, onSqlChange, functions }) {
    var _a;
    const styles = useStyles2(getStyles);
    const columnsWithAsterisk = [asteriskValue, ...(columns || [])];
    const timeSeriesAliasOpts = [];
    // Add necessary alias options for time series format
    // when that format has been selected
    if (format === QueryFormat.Timeseries) {
        timeSeriesAliasOpts.push({ label: 'time', value: 'time' });
        timeSeriesAliasOpts.push({ label: 'value', value: 'value' });
    }
    const onColumnChange = useCallback((item, index) => (column) => {
        var _a, _b;
        let modifiedItem = Object.assign({}, item);
        if (!((_a = item.parameters) === null || _a === void 0 ? void 0 : _a.length)) {
            modifiedItem.parameters = [{ type: QueryEditorExpressionType.FunctionParameter, name: column.value }];
        }
        else {
            modifiedItem.parameters = item.parameters.map((p) => p.type === QueryEditorExpressionType.FunctionParameter ? Object.assign(Object.assign({}, p), { name: column.value }) : p);
        }
        const newSql = Object.assign(Object.assign({}, sql), { columns: (_b = sql.columns) === null || _b === void 0 ? void 0 : _b.map((c, i) => (i === index ? modifiedItem : c)) });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    const onAggregationChange = useCallback((item, index) => (aggregation) => {
        var _a;
        const newItem = Object.assign(Object.assign({}, item), { name: aggregation === null || aggregation === void 0 ? void 0 : aggregation.value });
        const newSql = Object.assign(Object.assign({}, sql), { columns: (_a = sql.columns) === null || _a === void 0 ? void 0 : _a.map((c, i) => (i === index ? newItem : c)) });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    const onAliasChange = useCallback((item, index) => (alias) => {
        var _a, _b;
        let newItem = Object.assign({}, item);
        if (alias !== null) {
            newItem = Object.assign(Object.assign({}, item), { alias: `"${(_a = alias === null || alias === void 0 ? void 0 : alias.value) === null || _a === void 0 ? void 0 : _a.trim()}"` });
        }
        else {
            delete newItem.alias;
        }
        const newSql = Object.assign(Object.assign({}, sql), { columns: (_b = sql.columns) === null || _b === void 0 ? void 0 : _b.map((c, i) => (i === index ? newItem : c)) });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    const removeColumn = useCallback((index) => () => {
        const clone = [...sql.columns];
        clone.splice(index, 1);
        const newSql = Object.assign(Object.assign({}, sql), { columns: clone });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    const addColumn = useCallback(() => {
        const newSql = Object.assign(Object.assign({}, sql), { columns: [...sql.columns, createFunctionField()] });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    return (React.createElement(Stack, { gap: 2, wrap: true, direction: "column" }, (_a = sql.columns) === null || _a === void 0 ? void 0 :
        _a.map((item, index) => (React.createElement("div", { key: index },
            React.createElement(Stack, { gap: 2, alignItems: "end" },
                React.createElement(EditorField, { label: "Column", width: 25 },
                    React.createElement(Select, { value: getColumnValue(item), options: columnsWithAsterisk, inputId: `select-column-${index}-${uniqueId()}`, menuShouldPortal: true, allowCustomValue: true, onChange: onColumnChange(item, index) })),
                React.createElement(EditorField, { label: "Aggregation", optional: true, width: 25 },
                    React.createElement(Select, { value: item.name ? toOption(item.name) : null, inputId: `select-aggregation-${index}-${uniqueId()}`, isClearable: true, menuShouldPortal: true, allowCustomValue: true, options: functions, onChange: onAggregationChange(item, index) })),
                React.createElement(EditorField, { label: "Alias", optional: true, width: 15 },
                    React.createElement(Select, { value: item.alias ? toOption(item.alias) : null, inputId: `select-alias-${index}-${uniqueId()}`, options: timeSeriesAliasOpts, onChange: onAliasChange(item, index), isClearable: true, menuShouldPortal: true, allowCustomValue: true })),
                React.createElement(Button, { "aria-label": "Remove", type: "button", icon: "trash-alt", variant: "secondary", size: "md", onClick: removeColumn(index) }))))),
        React.createElement(Button, { type: "button", onClick: addColumn, variant: "secondary", size: "md", icon: "plus", "aria-label": "Add", className: styles.addButton })));
}
const getStyles = () => {
    return { addButton: css({ alignSelf: 'flex-start' }) };
};
function getColumnValue({ parameters }) {
    const column = parameters === null || parameters === void 0 ? void 0 : parameters.find((p) => p.type === QueryEditorExpressionType.FunctionParameter);
    if (column === null || column === void 0 ? void 0 : column.name) {
        return toOption(column.name);
    }
    return null;
}
//# sourceMappingURL=SelectRow.js.map