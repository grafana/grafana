import { __rest } from "tslib";
import { render } from '@testing-library/react';
import React from 'react';
import { getDefaultTimeRange } from '@grafana/data';
import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
const defaultProviderProps = {
    datasource: {},
    query: { refId: 'A' },
    onChange: () => void 0,
    onRunQuery: () => void 0,
    range: getDefaultTimeRange(),
};
export const renderWithESProvider = (ui, _a = { providerProps: defaultProviderProps }) => {
    var { providerProps: { datasource = defaultProviderProps.datasource, query = defaultProviderProps.query, onChange = defaultProviderProps.onChange, onRunQuery = defaultProviderProps.onRunQuery, range = defaultProviderProps.range, } = defaultProviderProps } = _a, renderOptions = __rest(_a, ["providerProps"]);
    return render(React.createElement(ElasticsearchProvider, { query: query, onChange: onChange, datasource: datasource, onRunQuery: onRunQuery, range: range }, ui), renderOptions);
};
//# sourceMappingURL=render.js.map