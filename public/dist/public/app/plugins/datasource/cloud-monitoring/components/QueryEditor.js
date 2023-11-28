import React, { useEffect, useMemo, useState } from 'react';
import { toOption } from '@grafana/data';
import { EditorRows } from '@grafana/experimental';
import { QueryType } from '../types/query';
import { PromQLQueryEditor } from './PromQLEditor';
import { QueryHeader } from './QueryHeader';
import { defaultQuery as defaultSLOQuery } from './SLOQueryEditor';
import { MetricQueryEditor, SLOQueryEditor } from './';
export const QueryEditor = (props) => {
    var _a, _b, _c;
    const { datasource, query: oldQ, onRunQuery, onChange } = props;
    // Migrate query if needed
    const [migrated, setMigrated] = useState(false);
    const query = useMemo(() => {
        if (!migrated) {
            setMigrated(true);
            const migratedQuery = datasource.migrateQuery(oldQ);
            // Update the query once the migrations have been completed.
            onChange(Object.assign({}, migratedQuery));
            return migratedQuery;
        }
        return oldQ;
    }, [oldQ, datasource, onChange, migrated]);
    const sloQuery = Object.assign(Object.assign({}, defaultSLOQuery(datasource)), query.sloQuery);
    const onSLOQueryChange = (q) => {
        onChange(Object.assign(Object.assign({}, query), { sloQuery: q }));
        onRunQuery();
    };
    const promQLQuery = Object.assign({ projectName: datasource.getDefaultProject(), expr: '', step: '10s' }, query.promQLQuery);
    const onPromQLQueryChange = (q) => {
        onChange(Object.assign(Object.assign({}, query), { promQLQuery: q }));
    };
    const meta = ((_a = props.data) === null || _a === void 0 ? void 0 : _a.series.length) ? (_b = props.data) === null || _b === void 0 ? void 0 : _b.series[0].meta : {};
    const customMetaData = (_c = meta === null || meta === void 0 ? void 0 : meta.custom) !== null && _c !== void 0 ? _c : {};
    const variableOptionGroup = {
        label: 'Template Variables',
        expanded: false,
        options: datasource.getVariables().map(toOption),
    };
    // Use a known query type
    useEffect(() => {
        if (!query.queryType || !Object.values(QueryType).includes(query.queryType)) {
            onChange(Object.assign(Object.assign({}, query), { queryType: QueryType.TIME_SERIES_LIST }));
        }
    });
    const queryType = query.queryType;
    return (React.createElement(EditorRows, null,
        React.createElement(QueryHeader, { query: query, onChange: onChange, onRunQuery: onRunQuery }),
        queryType === QueryType.PROMQL && (React.createElement(PromQLQueryEditor, { refId: query.refId, variableOptionGroup: variableOptionGroup, onChange: onPromQLQueryChange, onRunQuery: onRunQuery, datasource: datasource, query: promQLQuery })),
        queryType !== QueryType.SLO && (React.createElement(MetricQueryEditor, { refId: query.refId, variableOptionGroup: variableOptionGroup, customMetaData: customMetaData, onChange: onChange, onRunQuery: onRunQuery, datasource: datasource, query: query })),
        queryType === QueryType.SLO && (React.createElement(SLOQueryEditor, { refId: query.refId, variableOptionGroup: variableOptionGroup, customMetaData: customMetaData, onChange: onSLOQueryChange, onRunQuery: onRunQuery, datasource: datasource, query: sloQuery, aliasBy: query.aliasBy, onChangeAliasBy: (aliasBy) => onChange(Object.assign(Object.assign({}, query), { aliasBy })) }))));
};
//# sourceMappingURL=QueryEditor.js.map