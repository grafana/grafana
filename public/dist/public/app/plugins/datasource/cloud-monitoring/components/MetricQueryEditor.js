import React, { useCallback, useEffect } from 'react';
import { EditorRows, Stack } from '@grafana/experimental';
import { AlignmentTypes, QueryType } from '../types/query';
import { AliasBy } from './AliasBy';
import { GraphPeriod } from './GraphPeriod';
import { MQLQueryEditor } from './MQLQueryEditor';
import { Project } from './Project';
import { VisualMetricQueryEditor } from './VisualMetricQueryEditor';
export const defaultTimeSeriesList = (dataSource) => ({
    projectName: dataSource.getDefaultProject(),
    crossSeriesReducer: 'REDUCE_NONE',
    alignmentPeriod: 'cloud-monitoring-auto',
    perSeriesAligner: AlignmentTypes.ALIGN_MEAN,
    groupBys: [],
    filters: [],
});
export const defaultTimeSeriesQuery = (dataSource) => ({
    projectName: dataSource.getDefaultProject(),
    query: '',
});
function Editor({ refId, query, datasource, onChange: onQueryChange, onRunQuery, customMetaData, variableOptionGroup, }) {
    const onChangeTimeSeriesList = useCallback((timeSeriesList) => {
        onQueryChange(Object.assign(Object.assign({}, query), { timeSeriesList }));
        onRunQuery();
    }, [onQueryChange, onRunQuery, query]);
    const onChangeTimeSeriesQuery = useCallback((timeSeriesQuery) => {
        onQueryChange(Object.assign(Object.assign({}, query), { timeSeriesQuery }));
        onRunQuery();
    }, [onQueryChange, onRunQuery, query]);
    useEffect(() => {
        if (query.queryType === QueryType.TIME_SERIES_LIST && !query.timeSeriesList) {
            onQueryChange({
                refId: query.refId,
                datasource: query.datasource,
                queryType: QueryType.TIME_SERIES_LIST,
                timeSeriesList: defaultTimeSeriesList(datasource),
                aliasBy: query.aliasBy,
            });
        }
        if (query.queryType === QueryType.TIME_SERIES_QUERY && !query.timeSeriesQuery) {
            onQueryChange({
                refId: query.refId,
                datasource: query.datasource,
                queryType: QueryType.TIME_SERIES_QUERY,
                timeSeriesQuery: defaultTimeSeriesQuery(datasource),
                aliasBy: query.aliasBy,
            });
        }
    }, [onQueryChange, query, datasource]);
    return (React.createElement(EditorRows, null,
        (query.queryType === QueryType.ANNOTATION || query.queryType === QueryType.TIME_SERIES_LIST) &&
            query.timeSeriesList && (React.createElement(VisualMetricQueryEditor, { refId: refId, variableOptionGroup: variableOptionGroup, customMetaData: customMetaData, onChange: onChangeTimeSeriesList, datasource: datasource, query: query.timeSeriesList, aliasBy: query.aliasBy, onChangeAliasBy: (aliasBy) => onQueryChange(Object.assign(Object.assign({}, query), { aliasBy })) })),
        query.queryType === QueryType.TIME_SERIES_QUERY && query.timeSeriesQuery && (React.createElement(React.Fragment, null,
            React.createElement(Stack, { gap: 1, direction: "row" },
                React.createElement(Project, { refId: refId, datasource: datasource, onChange: (projectName) => onChangeTimeSeriesQuery(Object.assign(Object.assign({}, query.timeSeriesQuery), { projectName: projectName })), templateVariableOptions: variableOptionGroup.options, projectName: query.timeSeriesQuery.projectName }),
                React.createElement(AliasBy, { refId: refId, value: query.aliasBy, onChange: (aliasBy) => onQueryChange(Object.assign(Object.assign({}, query), { aliasBy })) })),
            React.createElement(MQLQueryEditor, { onChange: (q) => onChangeTimeSeriesQuery(Object.assign(Object.assign({}, query.timeSeriesQuery), { query: q })), onRunQuery: onRunQuery, query: query.timeSeriesQuery.query }),
            React.createElement(GraphPeriod, { onChange: (graphPeriod) => onChangeTimeSeriesQuery(Object.assign(Object.assign({}, query.timeSeriesQuery), { graphPeriod })), graphPeriod: query.timeSeriesQuery.graphPeriod, refId: refId, variableOptionGroup: variableOptionGroup })))));
}
export const MetricQueryEditor = React.memo(Editor);
//# sourceMappingURL=MetricQueryEditor.js.map