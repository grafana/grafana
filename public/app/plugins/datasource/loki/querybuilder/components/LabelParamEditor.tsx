import { useState } from 'react';

import { DataSourceApi, SelectableValue } from '@grafana/data';
import {
  QueryBuilderLabelFilter,
  QueryBuilderOperationParamEditorProps,
  QueryBuilderOperationParamValue,
  VisualQuery,
  VisualQueryModeller,
} from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import { getOperationParamId } from '../operationUtils';

export const LabelParamEditor = ({
  onChange,
  index,
  operationId,
  value,
  query,
  datasource,
  queryModeller,
}: QueryBuilderOperationParamEditorProps) => {
  const [state, setState] = useState<{
    options?: SelectableValue[];
    isLoading?: boolean;
  }>({});

  return (
    <Select<QueryBuilderOperationParamValue | undefined>
      inputId={getOperationParamId(operationId, index)}
      autoFocus={value === ''}
      openMenuOnFocus
      onOpenMenu={async () => {
        setState({ isLoading: true });
        const options = await loadGroupByLabels(query, datasource, queryModeller);
        setState({ options, isLoading: undefined });
      }}
      isLoading={state.isLoading}
      allowCustomValue
      noOptionsMessage="No labels found"
      loadingMessage="Loading labels"
      options={state.options}
      value={toOption(value)}
      onChange={(value) => onChange(index, value.value!)}
    />
  );
};

async function loadGroupByLabels(
  query: VisualQuery,
  datasource: DataSourceApi,
  queryModeller: VisualQueryModeller
): Promise<SelectableValue[]> {
  let labels: QueryBuilderLabelFilter[] = query.labels;

  const queryString = queryModeller.renderLabels(labels);
  const result: string[] = await datasource.languageProvider.fetchLabels({ streamSelector: queryString });

  return result.map((x) => ({
    label: x,
    value: x,
  }));
}

const toOption = (
  value: QueryBuilderOperationParamValue | undefined
): SelectableValue<QueryBuilderOperationParamValue | undefined> => ({ label: value?.toString(), value });
