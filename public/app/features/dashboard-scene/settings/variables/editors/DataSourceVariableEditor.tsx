import React, { FormEvent } from 'react';
import { lastValueFrom } from 'rxjs';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { DataSourceVariable, SceneVariable } from '@grafana/scenes';
import { Combobox, ComboboxOption, Input } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

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

export function getDataSourceVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof DataSourceVariable)) {
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      title: t('dashboard.edit-pane.variable.datasource-options.type', 'Type'),
      render: () => <DataSourceTypeSelect variable={variable} />,
    }),
    new OptionsPaneItemDescriptor({
      title: t('dashboard.edit-pane.variable.datasource-options.name-filter', 'Name filter'),
      description: t(
        'dashboard.edit-pane.variable.datasource-options.name-filter-description',
        'Regex filter for which data source instances to include. Leave empty for all.'
      ),
      render: () => <DataSourceNameFilter variable={variable} />,
    }),
  ];
}

function DataSourceTypeSelect({ variable }: { variable: DataSourceVariable }) {
  const { pluginId } = variable.useState();
  const options = getOptionDataSourceTypes();

  const onChange = async (value: ComboboxOption<string>) => {
    variable.setState({ pluginId: value.value });
    await lastValueFrom(variable.validateAndUpdate!());
  };

  return (
    <Combobox
      options={options}
      value={pluginId}
      onChange={onChange}
      placeholder={t('dashboard.edit-pane.variable.datasource-options.type-placeholder', 'Choose data source type')}
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect}
    />
  );
}

function DataSourceNameFilter({ variable }: { variable: DataSourceVariable }) {
  const { regex } = variable.useState();

  const onBlur = async (evt: React.FormEvent<HTMLInputElement>) => {
    variable.setState({ regex: evt.currentTarget.value });
    await lastValueFrom(variable.validateAndUpdate!());
  };

  return (
    <Input
      defaultValue={regex}
      onBlur={onBlur}
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.nameFilter}
      placeholder={t('dashboard.edit-pane.variable.datasource-options.name-filter-placeholder', 'Example: /^prod/')}
    />
  );
}
