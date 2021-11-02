import { __assign } from "tslib";
import React from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
export var CSVFileEditor = function (_a) {
    var onChange = _a.onChange, query = _a.query;
    var onChangeFileName = function (_a) {
        var value = _a.value;
        onChange(__assign(__assign({}, query), { csvFileName: value }));
    };
    var files = [
        'flight_info_by_state.csv',
        'population_by_state.csv',
        'gdp_per_capita.csv',
        'js_libraries.csv',
        'weight_height.csv',
        'browser_marketshare.csv',
    ].map(function (name) { return ({ label: name, value: name }); });
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "File", labelWidth: 14 },
            React.createElement(Select, { menuShouldPortal: true, width: 32, onChange: onChangeFileName, placeholder: "Select csv file", options: files, value: files.find(function (f) { return f.value === query.csvFileName; }) }))));
};
//# sourceMappingURL=CSVFileEditor.js.map