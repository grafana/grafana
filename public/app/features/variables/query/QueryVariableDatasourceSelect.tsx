import React, { PropsWithChildren, useMemo } from 'react';
import { DataSourceSelectItem, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSelectField } from '../editor/VariableSelectField';

interface Props {
  onChange: (option: SelectableValue<string>) => void;
  datasource: string | null;
  dataSources?: DataSourceSelectItem[];
}

export function QueryVariableDatasourceSelect({ onChange, datasource, dataSources }: PropsWithChildren<Props>) {
  const options = useMemo(() => {
    return dataSources ? dataSources.map(ds => ({ label: ds.name, value: ds.value ?? '' })) : [];
  }, [dataSources]);
  const value = useMemo(() => options.find(o => o.value === datasource) ?? options[0], [options, datasource]);

  return (
    <VariableSelectField
      name="Data source"
      value={value}
      options={options}
      onChange={onChange}
      labelWidth={10}
      ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect}
    />
  );
}
