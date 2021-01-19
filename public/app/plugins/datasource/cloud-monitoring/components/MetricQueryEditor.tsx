import React, { useState, useEffect } from 'react';
import { Project, VisualMetricQueryEditor, AliasBy } from '.';
import { MetricQuery, MetricDescriptor, EditorMode } from '../types';
import { getAlignmentPickerData } from '../functions';
import CloudMonitoringDatasource from '../datasource';
import { SelectableValue } from '@grafana/data';
import { MQLQueryEditor } from './MQLQueryEditor';

export interface Props {
  refId: string;
  usedAlignmentPeriod?: number;
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

export const defaultQuery: (dataSource: CloudMonitoringDatasource) => MetricQuery = dataSource => ({
  editorMode: EditorMode.Visual,
  projectName: dataSource.getDefaultProject(),
  metricType: '',
  metricKind: '',
  valueType: '',
  unit: '',
  crossSeriesReducer: 'REDUCE_MEAN',
  alignmentPeriod: 'cloud-monitoring-auto',
  perSeriesAligner: 'ALIGN_MEAN',
  groupBys: [],
  filters: [],
  aliasBy: '',
  query: '',
});

function Editor({
  refId,
  query,
  datasource,
  onChange: onQueryChange,
  onRunQuery,
  usedAlignmentPeriod,
  variableOptionGroup,
}: React.PropsWithChildren<Props>) {
  const [state, setState] = useState<State>(defaultState);

  useEffect(() => {
    if (query && query.projectName && query.metricType) {
      datasource
        .getLabels(query.metricType, refId, query.projectName, query.groupBys)
        .then(labels => setState({ ...state, labels }));
    }
  }, [query.projectName, query.groupBys, query.metricType]);

  const onChange = (metricQuery: MetricQuery) => {
    onQueryChange({ ...query, ...metricQuery });
    onRunQuery();
  };

  const onMetricTypeChange = async ({ valueType, metricKind, type, unit }: MetricDescriptor) => {
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(
      { valueType, metricKind, perSeriesAligner: state.perSeriesAligner },
      datasource.templateSrv
    );
    setState({
      ...state,
      alignOptions,
    });
    onChange({ ...query, perSeriesAligner, metricType: type, unit, valueType, metricKind });
  };

  return (
    <>
      <Project
        templateVariableOptions={variableOptionGroup.options}
        projectName={query.projectName}
        datasource={datasource}
        onChange={projectName => {
          onChange({ ...query, projectName });
        }}
      />

      {query.editorMode === EditorMode.Visual && (
        <VisualMetricQueryEditor
          labels={state.labels}
          variableOptionGroup={variableOptionGroup}
          usedAlignmentPeriod={usedAlignmentPeriod}
          onMetricTypeChange={onMetricTypeChange}
          onChange={onChange}
          datasource={datasource}
          query={query}
        />
      )}

      {query.editorMode === EditorMode.MQL && (
        <MQLQueryEditor
          onChange={(q: string) => onQueryChange({ ...query, query: q })}
          onRunQuery={onRunQuery}
          query={query.query}
        ></MQLQueryEditor>
      )}

      <AliasBy
        value={query.aliasBy}
        onChange={aliasBy => {
          onChange({ ...query, aliasBy });
        }}
      />
    </>
  );
}

export const MetricQueryEditor = React.memo(Editor);
