import React, { useState, useEffect, useCallback } from 'react';
import { SelectableValue } from '@grafana/data';
import { Project, VisualMetricQueryEditor, AliasBy } from '.';
import {
  MetricQuery,
  MetricDescriptor,
  EditorMode,
  MetricKind,
  PreprocessorType,
  AlignmentTypes,
  CustomMetaData,
  ValueTypes,
  SLOQuery,
} from '../types';
import { getAlignmentPickerData } from '../functions';
import CloudMonitoringDatasource from '../datasource';
import { MQLQueryEditor } from './MQLQueryEditor';

export interface Props {
  refId: string;
  customMetaData: CustomMetaData;
  variableOptionGroup: SelectableValue<string>;
  onChange: (query: MetricQuery) => void;
  onRunQuery: () => void;
  query: MetricQuery;
  datasource: CloudMonitoringDatasource;
}

interface State {
  labels: any;
  [key: string]: any;
}

export const defaultState: State = {
  labels: {},
};

export const defaultQuery: (dataSource: CloudMonitoringDatasource) => MetricQuery = (dataSource) => ({
  editorMode: EditorMode.Visual,
  projectName: dataSource.getDefaultProject(),
  metricType: '',
  metricKind: MetricKind.GAUGE,
  valueType: '',
  crossSeriesReducer: 'REDUCE_MEAN',
  alignmentPeriod: 'cloud-monitoring-auto',
  perSeriesAligner: AlignmentTypes.ALIGN_MEAN,
  groupBys: [],
  filters: [],
  aliasBy: '',
  query: '',
  preprocessor: PreprocessorType.None,
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
  const [state, setState] = useState<State>(defaultState);
  const { projectName, metricType, groupBys, editorMode, crossSeriesReducer } = query;

  useEffect(() => {
    if (projectName && metricType) {
      datasource
        .getLabels(metricType, refId, projectName, { groupBys, crossSeriesReducer })
        .then((labels) => setState((prevState) => ({ ...prevState, labels })));
    }
  }, [datasource, groupBys, metricType, projectName, refId, crossSeriesReducer]);

  const onChange = useCallback(
    (metricQuery: MetricQuery | SLOQuery) => {
      onQueryChange({ ...query, ...metricQuery });
      onRunQuery();
    },
    [onQueryChange, onRunQuery, query]
  );

  const onMetricTypeChange = useCallback(
    ({ valueType, metricKind, type }: MetricDescriptor) => {
      const preprocessor =
        metricKind === MetricKind.GAUGE || valueType === ValueTypes.DISTRIBUTION
          ? PreprocessorType.None
          : PreprocessorType.Rate;
      const { perSeriesAligner } = getAlignmentPickerData(valueType, metricKind, state.perSeriesAligner, preprocessor);
      onChange({
        ...query,
        perSeriesAligner,
        metricType: type,
        valueType,
        metricKind,
        preprocessor,
      });
    },
    [onChange, query, state]
  );

  return (
    <>
      <Project
        templateVariableOptions={variableOptionGroup.options}
        projectName={projectName}
        datasource={datasource}
        onChange={(projectName) => {
          onChange({ ...query, projectName });
        }}
      />

      {editorMode === EditorMode.Visual && (
        <VisualMetricQueryEditor
          labels={state.labels}
          variableOptionGroup={variableOptionGroup}
          customMetaData={customMetaData}
          onMetricTypeChange={onMetricTypeChange}
          onChange={onChange}
          datasource={datasource}
          query={query}
        />
      )}

      {editorMode === EditorMode.MQL && (
        <MQLQueryEditor
          onChange={(q: string) => onQueryChange({ ...query, query: q })}
          onRunQuery={onRunQuery}
          query={query.query}
        ></MQLQueryEditor>
      )}

      <AliasBy
        value={query.aliasBy}
        onChange={(aliasBy) => {
          onChange({ ...query, aliasBy });
        }}
      />
    </>
  );
}

export const MetricQueryEditor = React.memo(Editor);
