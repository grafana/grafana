import React, { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import { toOption } from '@grafana/data';
import { EditorField, EditorRows } from '@grafana/experimental';
import { Input } from '@grafana/ui';
import { QueryType } from '../types/query';
import { MetricQueryEditor, defaultTimeSeriesList } from './MetricQueryEditor';
import { AnnotationsHelp } from './';
export const defaultQuery = (datasource) => (Object.assign(Object.assign({}, defaultTimeSeriesList(datasource)), { title: '', text: '' }));
export const AnnotationQueryEditor = (props) => {
    var _a;
    const { datasource, query, onRunQuery, data, onChange } = props;
    const meta = (data === null || data === void 0 ? void 0 : data.series.length) ? data === null || data === void 0 ? void 0 : data.series[0].meta : {};
    const customMetaData = (_a = meta === null || meta === void 0 ? void 0 : meta.custom) !== null && _a !== void 0 ? _a : {};
    const timeSeriesList = Object.assign(Object.assign({}, defaultQuery(datasource)), query.timeSeriesList);
    const [title, setTitle] = useState(timeSeriesList.title || '');
    const [text, setText] = useState(timeSeriesList.text || '');
    const variableOptionGroup = {
        label: 'Template Variables',
        options: datasource.getVariables().map(toOption),
    };
    const handleTitleChange = (e) => {
        setTitle(e.target.value);
    };
    const handleTextChange = (e) => {
        setText(e.target.value);
    };
    useDebounce(() => {
        onChange(Object.assign(Object.assign({}, query), { timeSeriesList: Object.assign(Object.assign({}, timeSeriesList), { title }) }));
    }, 1000, [title, onChange]);
    useDebounce(() => {
        onChange(Object.assign(Object.assign({}, query), { timeSeriesList: Object.assign(Object.assign({}, timeSeriesList), { text }) }));
    }, 1000, [text, onChange]);
    // Use a known query type
    useEffect(() => {
        if (!query.queryType || !Object.values(QueryType).includes(query.queryType)) {
            onChange(Object.assign(Object.assign({}, query), { queryType: QueryType.TIME_SERIES_LIST }));
        }
    });
    return (React.createElement(EditorRows, null,
        React.createElement(React.Fragment, null,
            React.createElement(MetricQueryEditor, { refId: query.refId, variableOptionGroup: variableOptionGroup, customMetaData: customMetaData, onChange: onChange, onRunQuery: onRunQuery, datasource: datasource, query: query }),
            React.createElement(EditorField, { label: "Title", htmlFor: "annotation-query-title" },
                React.createElement(Input, { id: "annotation-query-title", value: title, onChange: handleTitleChange })),
            React.createElement(EditorField, { label: "Text", htmlFor: "annotation-query-text" },
                React.createElement(Input, { id: "annotation-query-text", value: text, onChange: handleTextChange }))),
        React.createElement(AnnotationsHelp, null)));
};
//# sourceMappingURL=AnnotationQueryEditor.js.map