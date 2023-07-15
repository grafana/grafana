import React, { useCallback, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRows } from '@grafana/experimental';

import CloudMonitoringDatasource from '../datasource';
import { AlignmentTypes, CloudMonitoringQuery, QueryType, TimeSeriesList, TimeSeriesQuery } from '../types/query';
import { CustomMetaData } from '../types/types';

import { GraphPeriod } from './GraphPeriod';
import { MQLQueryEditor } from './MQLQueryEditor';
import { Project } from './Project';
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
      onQueryChange({
        refId: query.refId,
        datasource: query.datasource,
        queryType: QueryType.TIME_SERIES_LIST,
        timeSeriesList: defaultTimeSeriesList(datasource),
      });
    }
    if (query.queryType === QueryType.TIME_SERIES_QUERY && !query.timeSeriesQuery) {
      onQueryChange({
        refId: query.refId,
        datasource: query.datasource,
        queryType: QueryType.TIME_SERIES_QUERY,
        timeSeriesQuery: defaultTimeSeriesQuery(datasource),
      });
    }
  }, [onQueryChange, query, datasource]);

  return (
    <EditorRows>
      {(query.queryType === QueryType.ANNOTATION || query.queryType === QueryType.TIME_SERIES_LIST) &&
        query.timeSeriesList && (
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
          <Project
            refId={refId}
            datasource={datasource}
            onChange={(projectName) => onChangeTimeSeriesQuery({ ...query.timeSeriesQuery!, projectName: projectName })}
            templateVariableOptions={variableOptionGroup.options}
            projectName={query.timeSeriesQuery.projectName!}
          />
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
