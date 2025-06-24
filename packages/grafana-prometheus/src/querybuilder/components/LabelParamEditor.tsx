// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/LabelParamEditor.tsx
import { useState } from 'react';

import { DataSourceApi, SelectableValue, TimeRange, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';

import { getOperationParamId } from '../shared/param_utils';
import { QueryBuilderLabelFilter, QueryBuilderOperationParamEditorProps } from '../shared/types';
import { PromVisualQuery, PromQueryModellerInterface } from '../types';

/**
 * Props for the LabelParamEditor component.
 * This editor specifically requires a Prometheus query modeller instance.
 */
export interface LabelParamEditorProps extends Omit<QueryBuilderOperationParamEditorProps, 'queryModeller'> {
  queryModeller: PromQueryModellerInterface;
}

/**
 * Editor for label parameters that requires a Prometheus query modeller instance.
 * This is used by the OperationParamEditorWrapper which ensures the modeller is always provided.
 */
export function LabelParamEditor({
  onChange,
  index,
  operationId,
  value,
  query,
  datasource,
  timeRange,
  queryModeller,
}: LabelParamEditorProps) {
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
        const options = await loadGroupByLabels(timeRange, query, datasource, queryModeller);
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
  datasource: DataSourceApi,
  modeller: PromQueryModellerInterface
): Promise<SelectableValue[]> {
  let labels: QueryBuilderLabelFilter[] = query.labels;

  // This function is used by both Prometheus and Loki and this the only difference.
  if (datasource.type === 'prometheus') {
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    labels = [{ label: '__name__', op: '=', value: query.metric }, ...query.labels];
  }

  const expr = modeller.renderLabels(labels);
  const result = await datasource.languageProvider.queryLabelKeys(timeRange, expr);

  return Object.keys(result).map((x) => ({
    label: x,
    value: x,
  }));
}
