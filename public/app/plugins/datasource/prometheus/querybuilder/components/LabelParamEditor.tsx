import { SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';
import { isArray } from 'lodash';
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

  if (!isArray(value)) {
    return value;
  }

  return (
    <Select
      isMulti={true}
      openMenuOnFocus
      autoFocus={value.length === 0}
      menuShouldPortal
      onOpenMenu={async () => {
        setState({ isLoading: true });
        const options = await loadGroupByLabels(query as PromVisualQuery, datasource as PrometheusDatasource);
        setState({ options, isLoading: undefined });
      }}
      isLoading={state.isLoading}
      noOptionsMessage="No labels found"
      loadingMessage="Loading labels"
      allowCustomValue
      options={state.options}
      value={value.map((x) => toOption(x as string))}
      onChange={(value) =>
        onChange(
          index,
          value.map((x: SelectableValue<string>) => x.value)
        )
      }
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
