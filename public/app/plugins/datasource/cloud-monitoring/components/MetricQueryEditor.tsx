import { useCallback, useEffect } from 'react';
import * as React from 'react';

import { SelectableValue, TimeRange } from '@grafana/data';
import { EditorRows } from '@grafana/plugin-ui';
import { Stack } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';
import { AlignmentTypes, CloudMonitoringQuery, QueryType, TimeSeriesList, TimeSeriesQuery } from '../types/query';
import { CustomMetaData } from '../types/types';

import { AliasBy } from './AliasBy';
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
  range: TimeRange;
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
  range,
}: React.PropsWithChildren<Props>) {
  const onChangeTimeSeriesList = useCallback(
    (timeSeriesList: TimeSeriesList) => {
      let filtersComplete = true;
      if (timeSeriesList?.filters && timeSeriesList.filters.length > 0) {
        for (const filter of timeSeriesList.filters) {
          if (filter === '') {
            filtersComplete = false;
            break;
          }
        }
      }
      onQueryChange({ ...query, timeSeriesList });
      if (filtersComplete) {
        onRunQuery();
      }
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
            range={range}
          />
        )}

      {query.queryType === QueryType.TIME_SERIES_QUERY && query.timeSeriesQuery && (
        <>
          <Stack gap={1} direction="row">
            <Project
              refId={refId}
              datasource={datasource}
              onChange={(projectName) =>
                onChangeTimeSeriesQuery({ ...query.timeSeriesQuery!, projectName: projectName })
              }
              templateVariableOptions={variableOptionGroup.options}
              projectName={query.timeSeriesQuery.projectName!}
            />
            <AliasBy
              refId={refId}
              value={query.aliasBy}
              onChange={(aliasBy: string) => onQueryChange({ ...query, aliasBy })}
            />
          </Stack>
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
