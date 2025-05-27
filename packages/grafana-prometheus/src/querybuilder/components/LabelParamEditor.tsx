// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/LabelParamEditor.tsx
import { useState } from 'react';

import { DataSourceApi, SelectableValue, TimeRange, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';

import { promQueryModeller } from '../PromQueryModeller';
import { getOperationParamId } from '../operationUtils';
import { QueryBuilderLabelFilter, QueryBuilderOperationParamEditorProps } from '../shared/types';
import { PromVisualQuery } from '../types';

export function LabelParamEditor({
  onChange,
  index,
  operationId,
  value,
  query,
  datasource,
  timeRange,
}: QueryBuilderOperationParamEditorProps) {
  const [state, setState] = useState<{
    options?: SelectableValue[];
    isLoading?: boolean;
  }>({});

  return (
    <Select
      inputId={getOperationParamId(operationId, index)}
      autoFocus={value === '' ? true : undefined}
      openMenuOnFocus
      onOpenMenu={async () => {
        setState({ isLoading: true });
        const options = await loadGroupByLabels(timeRange, query, datasource);
        setState({ options, isLoading: undefined });
      }}
      isLoading={state.isLoading}
      allowCustomValue
      noOptionsMessage="No labels found"
      loadingMessage="Loading labels"
      options={state.options}
      value={toOption(value as string)}
      onChange={(value) => onChange(index, value.value!)}
    />
  );
}

async function loadGroupByLabels(
  timeRange: TimeRange,
  query: PromVisualQuery,
  datasource: DataSourceApi
): Promise<SelectableValue[]> {
  let labels: QueryBuilderLabelFilter[] = query.labels;

  // This function is used by both Prometheus and Loki and this the only difference.
  if (datasource.type === 'prometheus') {
    labels = [{ label: '__name__', op: '=', value: query.metric }, ...query.labels];
  }

  const expr = promQueryModeller.renderLabels(labels);
  const result = await datasource.languageProvider.fetchLabelsWithMatch(timeRange, expr);

  return Object.keys(result).map((x) => ({
    label: x,
    value: x,
  }));
}
