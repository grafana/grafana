import { SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';
import React, { useState } from 'react';
import { PrometheusDatasource } from '../../datasource';
import { promQueryModeller } from '../PromQueryModeller';
import { QueryBuilderOperationParamEditorProps } from '../shared/types';
import { PromVisualQuery } from '../types';

export function LabelParamEditor({ onChange, index, value, query, datasource }: QueryBuilderOperationParamEditorProps) {
  const [state, setState] = useState<{
    options?: Array<SelectableValue<any>>;
    isLoading?: boolean;
  }>({});

  return (
    <Select
      menuShouldPortal
      autoFocus={value === '' ? true : undefined}
      openMenuOnFocus
      onOpenMenu={async () => {
        setState({ isLoading: true });
        const options = await loadGroupByLabels(query as PromVisualQuery, datasource as PrometheusDatasource);
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
  query: PromVisualQuery,
  datasource: PrometheusDatasource
): Promise<Array<SelectableValue<any>>> {
  const labels = [{ label: '__name__', op: '=', value: query.metric }, ...query.labels];
  const expr = promQueryModeller.renderLabels(labels);

  const result = await datasource.languageProvider.fetchSeriesLabels(expr);

  return Object.keys(result).map((x) => ({
    label: x,
    value: x,
  }));
}
