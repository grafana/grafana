import { __rest } from "tslib";
import React from 'react';
import { render } from '@testing-library/react';
import { getDefaultTimeRange } from '@grafana/data';
import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
var defaultProviderProps = {
    datasource: {},
    query: { refId: 'A' },
    onChange: function () { return void 0; },
    onRunQuery: function () { return void 0; },
    range: getDefaultTimeRange(),
};
export var renderWithESProvider = function (ui, _a) {
    if (_a === void 0) { _a = { providerProps: defaultProviderProps }; }
    var _b = _a.providerProps, _c = _b === void 0 ? defaultProviderProps : _b, _d = _c.datasource, datasource = _d === void 0 ? defaultProviderProps.datasource : _d, _e = _c.query, query = _e === void 0 ? defaultProviderProps.query : _e, _f = _c.onChange, onChange = _f === void 0 ? defaultProviderProps.onChange : _f, _g = _c.onRunQuery, onRunQuery = _g === void 0 ? defaultProviderProps.onRunQuery : _g, _h = _c.range, range = _h === void 0 ? defaultProviderProps.range : _h, renderOptions = __rest(_a, ["providerProps"]);
    return render(React.createElement(ElasticsearchProvider, { query: query, onChange: onChange, datasource: datasource, onRunQuery: onRunQuery, range: range }, ui), renderOptions);
};
//# sourceMappingURL=render.js.map