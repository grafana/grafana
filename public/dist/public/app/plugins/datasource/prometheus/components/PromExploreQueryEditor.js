import { __assign } from "tslib";
import React, { memo, useEffect } from 'react';
import { CoreApp } from '@grafana/data';
import PromQueryField from './PromQueryField';
import { PromExploreExtraField } from './PromExploreExtraField';
export var PromExploreQueryEditor = function (props) {
    var range = props.range, query = props.query, data = props.data, datasource = props.datasource, history = props.history, onChange = props.onChange, onRunQuery = props.onRunQuery;
    // Setting default values
    useEffect(function () {
        if (query.expr === undefined) {
            onChange(__assign(__assign({}, query), { expr: '' }));
        }
        if (query.exemplar === undefined) {
            onChange(__assign(__assign({}, query), { exemplar: true }));
        }
        if (!query.instant && !query.range) {
            onChange(__assign(__assign({}, query), { instant: true, range: true }));
        }
    }, [onChange, query]);
    return (React.createElement(PromQueryField, { app: CoreApp.Explore, datasource: datasource, query: query, range: range, onRunQuery: onRunQuery, onChange: onChange, onBlur: function () { }, history: history, data: data, ExtraFieldElement: React.createElement(PromExploreExtraField, { query: query, onChange: onChange, datasource: datasource, onRunQuery: onRunQuery }) }));
};
export default memo(PromExploreQueryEditor);
//# sourceMappingURL=PromExploreQueryEditor.js.map