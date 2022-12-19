import React, { useCallback, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRows } from '@grafana/experimental';

import CloudMonitoringDatasource from '../datasource';
import {
  AlignmentTypes,
  CloudMonitoringQuery,
  CustomMetaData,
  QueryType,
  TimeSeriesList,
  TimeSeriesQuery,
} from '../types';

import { GraphPeriod } from './GraphPeriod';
import { MQLQueryEditor } from './MQLQueryEditor';
import { VisualMetricQueryEditor } from './VisualMetricQueryEditor';

export interface Props {
  refId: string;
  customMetaData: CustomMetaData;
  variableOptionGroup: SelectableValue<string>;
  onChange: (query: CloudMonitoringQuery) => void;
  onRunQuery: () => void;
  query: CloudMonitoringQuery;
  datasource: CloudMonitoringDatasource;
}

export const defaultTimeSeriesList: (dataSource: CloudMonitoringDatasource) => TimeSeriesList = (dataSource) => ({
  projectName: dataSource.getDefaultProject(),
  crossSeriesReducer: 'REDUCE_NONE',
  alignmentPeriod: 'cloud-monitoring-auto',
  perSeriesAligner: AlignmentTypes.ALIGN_MEAN,
  groupBys: [],
  filters: [],
});

export const defaultTimeSeriesQuery: (dataSource: CloudMonitoringDatasource) => TimeSeriesQuery = (dataSource) => ({
  projectName: dataSource.getDefaultProject(),
  query: '',
});

function Editor({
  refId,
  query,
  datasource,
  onChange: onQueryChange,
  onRunQuery,
  customMetaData,
  variableOptionGroup,
}: React.PropsWithChildren<Props>) {
  const onChangeTimeSeriesList = useCallback(
    (timeSeriesList: TimeSeriesList) => {
      onQueryChange({ ...query, timeSeriesList });
      onRunQuery();
    },
    [onQueryChange, onRunQuery, query]
  );

  const onChangeTimeSeriesQuery = useCallback(
    (timeSeriesQuery: TimeSeriesQuery) => {
      onQueryChange({ ...query, timeSeriesQuery });
      onRunQuery();
    },
    [onQueryChange, onRunQuery, query]
  );

  useEffect(() => {
    if (query.queryType === QueryType.TIME_SERIES_LIST && !query.timeSeriesList) {
      onChangeTimeSeriesList(defaultTimeSeriesList(datasource));
    }
    if (query.queryType === QueryType.TIME_SERIES_QUERY && !query.timeSeriesQuery) {
      onChangeTimeSeriesQuery(defaultTimeSeriesQuery(datasource));
    }
  }, [
    onChangeTimeSeriesList,
    onChangeTimeSeriesQuery,
    query.queryType,
    query.timeSeriesList,
    query.timeSeriesQuery,
    datasource,
  ]);

  return (
    <EditorRows>
      {[QueryType.TIME_SERIES_LIST, QueryType.ANNOTATION].includes(query.queryType) && query.timeSeriesList && (
        <VisualMetricQueryEditor
          refId={refId}
          variableOptionGroup={variableOptionGroup}
          customMetaData={customMetaData}
          onChange={onChangeTimeSeriesList}
          datasource={datasource}
          query={query.timeSeriesList}
          aliasBy={query.aliasBy}
          onChangeAliasBy={(aliasBy: string) => onQueryChange({ ...query, aliasBy })}
        />
      )}

      {query.queryType === QueryType.TIME_SERIES_QUERY && query.timeSeriesQuery && (
        <>
          <MQLQueryEditor
            onChange={(q: string) => onChangeTimeSeriesQuery({ ...query.timeSeriesQuery!, query: q })}
            onRunQuery={onRunQuery}
            query={query.timeSeriesQuery.query}
          ></MQLQueryEditor>
          <GraphPeriod
            onChange={(graphPeriod: string) => onChangeTimeSeriesQuery({ ...query.timeSeriesQuery!, graphPeriod })}
            graphPeriod={query.timeSeriesQuery.graphPeriod}
            refId={refId}
            variableOptionGroup={variableOptionGroup}
          />
        </>
      )}
    </EditorRows>
  );
}

export const MetricQueryEditor = React.memo(Editor);
