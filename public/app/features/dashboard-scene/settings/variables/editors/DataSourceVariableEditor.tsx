import { FormEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { DataSourceVariable } from '@grafana/scenes';

import { DataSourceVariableForm } from '../components/DataSourceVariableForm';
import { getOptionDataSourceTypes } from '../utils';

interface DataSourceVariableEditorProps {
  variable: DataSourceVariable;
  onRunQuery: () => void;
}

export function DataSourceVariableEditor({ variable, onRunQuery }: DataSourceVariableEditorProps) {
  const { pluginId, regex, isMulti, allValue, includeAll, allowCustomValue } = variable.useState();

  const optionTypes = getOptionDataSourceTypes();

  const onChangeType = (option: SelectableValue) => {
    variable.setState({
      pluginId: option.value,
    });
    onRunQuery();
  };

  const onRegExChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({
      regex: event.currentTarget.value,
    });
    onRunQuery();
  };

  const onMultiChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({
      isMulti: event.currentTarget.checked,
    });
  };

  const onIncludeAllChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ includeAll: event.currentTarget.checked });
  };

  const onAllValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allValue: event.currentTarget.value });
  };

  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };

  return (
    <DataSourceVariableForm
      query={pluginId}
      regex={regex}
      multi={isMulti || false}
      allValue={allValue}
      includeAll={includeAll || false}
      optionTypes={optionTypes}
      allowCustomValue={allowCustomValue}
      onChange={onChangeType}
      onRegExBlur={onRegExChange}
      onMultiChange={onMultiChange}
      onIncludeAllChange={onIncludeAllChange}
      onAllValueChange={onAllValueChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
    />
  );
}
