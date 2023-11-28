import React from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
export const CSVFileEditor = ({ onChange, query }) => {
    const onChangeFileName = ({ value }) => {
        onChange(Object.assign(Object.assign({}, query), { csvFileName: value }));
    };
    const files = [
        'flight_info_by_state.csv',
        'population_by_state.csv',
        'gdp_per_capita.csv',
        'js_libraries.csv',
        'ohlc_dogecoin.csv',
        'weight_height.csv',
        'browser_marketshare.csv',
    ].map((name) => ({ label: name, value: name }));
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "File", labelWidth: 14 },
            React.createElement(Select, { width: 32, onChange: onChangeFileName, placeholder: "Select csv file", options: files, value: files.find((f) => f.value === query.csvFileName) }))));
};
//# sourceMappingURL=CSVFileEditor.js.map