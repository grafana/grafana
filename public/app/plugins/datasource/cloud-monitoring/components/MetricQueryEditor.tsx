import React, { useCallback, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRows } from '@grafana/experimental';

import CloudMonitoringDatasource from '../datasource';
import { getAlignmentPickerData } from '../functions';
import {
  AlignmentTypes,
  CustomMetaData,
  EditorMode,
  MetricDescriptor,
  MetricKind,
  MetricQuery,
  PreprocessorType,
  SLOQuery,
  ValueTypes,
} from '../types';

import { GraphPeriod } from './GraphPeriod';
import { MQLQueryEditor } from './MQLQueryEditor';
import { VisualMetricQueryEditor } from './VisualMetricQueryEditor';

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
  crossSeriesReducer: 'REDUCE_NONE',
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
        .getLabels(metricType, refId, projectName)
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
    <EditorRows>
      {editorMode === EditorMode.Visual && (
        <VisualMetricQueryEditor
          refId={refId}
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
        <>
          <MQLQueryEditor
            onChange={(q: string) => onQueryChange({ ...query, query: q })}
            onRunQuery={onRunQuery}
            query={query.query}
          ></MQLQueryEditor>
          <GraphPeriod
            onChange={(graphPeriod: string) => onQueryChange({ ...query, graphPeriod })}
            graphPeriod={query.graphPeriod}
            refId={refId}
            variableOptionGroup={variableOptionGroup}
          />
        </>
      )}
    </EditorRows>
  );
}

export const MetricQueryEditor = React.memo(Editor);
