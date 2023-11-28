import React, { useCallback, useEffect, useState } from 'react';
import { InlineField, RadioButtonGroup, Select } from '@grafana/ui';
import { setDashboardTime, setTimeColumn } from './setQueryValue';
export function TimeManagement({ query, onQueryChange: onChange, schema }) {
    var _a, _b, _c, _d, _e, _f, _g;
    const [defaultTimeColumns, setDefaultTimeColumns] = useState();
    const [timeColumns, setTimeColumns] = useState();
    const setDefaultColumn = useCallback((column) => onChange(setTimeColumn(query, column)), [query, onChange]);
    useEffect(() => {
        var _a;
        if (schema && ((_a = query.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.dashboardTime)) {
            const timeColumnOptions = [];
            const timeColumnsSet = new Set();
            const defaultColumnsMap = new Map();
            const db = schema.database;
            if (db) {
                for (const table of db.tables) {
                    const cols = table.columns.reduce((prev, curr, i) => {
                        if (curr.type === 'datetime') {
                            if (!table.timespanColumn || table.timespanColumn !== curr.name) {
                                prev.push({ value: curr.name, label: `${table.name} > ${curr.name}` });
                                timeColumnsSet.add(curr.name);
                            }
                        }
                        return prev;
                    }, []);
                    timeColumnOptions.push(...cols);
                    if (table.timespanColumn && !defaultColumnsMap.has(table.timespanColumn)) {
                        defaultColumnsMap.set(table.timespanColumn, {
                            value: table.timespanColumn,
                            label: table.timespanColumn,
                        });
                    }
                }
            }
            setTimeColumns(timeColumnOptions);
            const defaultColumns = Array.from(defaultColumnsMap.values());
            setDefaultTimeColumns(defaultColumns);
            // Set default value
            if (!query.azureLogAnalytics.timeColumn ||
                (query.azureLogAnalytics.timeColumn &&
                    !timeColumnsSet.has(query.azureLogAnalytics.timeColumn) &&
                    !defaultColumnsMap.has(query.azureLogAnalytics.timeColumn))) {
                if (defaultColumns && defaultColumns.length) {
                    setDefaultColumn(defaultColumns[0].value);
                    setDefaultColumn(defaultColumns[0].value);
                    return;
                }
                else if (timeColumnOptions && timeColumnOptions.length) {
                    setDefaultColumn(timeColumnOptions[0].value);
                    return;
                }
                else {
                    setDefaultColumn('TimeGenerated');
                    return;
                }
            }
        }
    }, [schema, (_a = query.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.dashboardTime, (_b = query.azureLogAnalytics) === null || _b === void 0 ? void 0 : _b.timeColumn, setDefaultColumn]);
    const handleTimeColumnChange = useCallback((change) => {
        if (!change.value) {
            return;
        }
        const newQuery = setTimeColumn(query, change.value);
        onChange(newQuery);
    }, [onChange, query]);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineField, { label: "Time-range", tooltip: React.createElement("span", null,
                "Specifies the time-range used to query. The ",
                React.createElement("code", null, "Query"),
                " option will only use time-ranges specified in the query. ",
                React.createElement("code", null, "Dashboard"),
                " will only use the Grafana time-range.") },
            React.createElement(RadioButtonGroup, { options: [
                    { label: 'Query', value: false },
                    { label: 'Dashboard', value: true },
                ], value: (_d = (_c = query.azureLogAnalytics) === null || _c === void 0 ? void 0 : _c.dashboardTime) !== null && _d !== void 0 ? _d : false, size: 'md', onChange: (val) => onChange(setDashboardTime(query, val)) })),
        ((_e = query.azureLogAnalytics) === null || _e === void 0 ? void 0 : _e.dashboardTime) && (React.createElement(InlineField, { label: "Time Column", tooltip: React.createElement("span", null,
                "Specifies the time column used for filtering. Defaults to the first tables ",
                React.createElement("code", null, "timeSpan"),
                " column, the first ",
                React.createElement("code", null, "datetime"),
                " column found or ",
                React.createElement("code", null, "TimeGenerated"),
                ".") },
            React.createElement(Select, { options: [
                    {
                        label: 'Default time columns',
                        options: defaultTimeColumns !== null && defaultTimeColumns !== void 0 ? defaultTimeColumns : [{ value: 'TimeGenerated', label: 'TimeGenerated' }],
                    },
                    {
                        label: 'Other time columns',
                        options: timeColumns !== null && timeColumns !== void 0 ? timeColumns : [],
                    },
                ], onChange: handleTimeColumnChange, value: ((_f = query.azureLogAnalytics) === null || _f === void 0 ? void 0 : _f.timeColumn)
                    ? (_g = query.azureLogAnalytics) === null || _g === void 0 ? void 0 : _g.timeColumn
                    : defaultTimeColumns
                        ? defaultTimeColumns[0]
                        : timeColumns
                            ? timeColumns[0]
                            : { value: 'TimeGenerated', label: 'TimeGenerated' }, allowCustomValue: true })))));
}
//# sourceMappingURL=TimeManagement.js.map