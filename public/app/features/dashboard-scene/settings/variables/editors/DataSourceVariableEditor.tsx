import React, { type FormEvent } from 'react';
import { lastValueFrom } from 'rxjs';

import { type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { DataSourceVariable, type SceneVariable } from '@grafana/scenes';
import { Combobox, type ComboboxOption, Input } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions } from '../../../sidebar/shared';
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
      title: t('dashboard.sidebar.variable.datasource-options.type', 'Type'),
      id: 'datasource-options-type',
      render: ({ props }) => <DataSourceTypeSelect id={props.id} variable={variable} />,
    }),
    new OptionsPaneItemDescriptor({
      title: t('dashboard.sidebar.variable.datasource-options.name-filter', 'Name filter'),
      id: 'datasource-options-name-filter',
      description: t(
        'dashboard.sidebar.variable.datasource-options.name-filter-description',
        'Regex filter for which data source instances to include. Leave empty for all.'
      ),
      render: ({ props }) => <DataSourceNameFilter id={props.id} variable={variable} />,
    }),
  ];
}

interface InputProps {
  variable: DataSourceVariable;
  id?: string;
}

function DataSourceTypeSelect({ variable, id }: InputProps) {
  const { pluginId } = variable.useState();
  const options = getOptionDataSourceTypes();

  const onChange = (value: ComboboxOption<string>) => {
    const prevPluginId = variable.state.pluginId;
    if (value.value === prevPluginId) {
      return;
    }

    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.variable-datasource-type', 'Change variable data source type'),
      source: variable,
      perform: () => {
        variable.setState({ pluginId: value.value });
        lastValueFrom(variable.validateAndUpdate!());
      },
      undo: () => {
        variable.setState({ pluginId: prevPluginId });
        lastValueFrom(variable.validateAndUpdate!());
      },
    });
  };

  return (
    <Combobox
      id={id}
      options={options}
      value={pluginId}
      onChange={onChange}
      placeholder={t('dashboard.sidebar.variable.datasource-options.type-placeholder', 'Choose data source type')}
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect}
    />
  );
}

function DataSourceNameFilter({ variable, id }: InputProps) {
  const { regex } = variable.useState();

  const onBlur = (evt: React.FormEvent<HTMLInputElement>) => {
    const newRegex = evt.currentTarget.value;
    const prevRegex = variable.state.regex;
    if (newRegex === prevRegex) {
      return;
    }

    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.variable-name-filter', 'Change variable name filter'),
      source: variable,
      perform: () => {
        variable.setState({ regex: newRegex });
        lastValueFrom(variable.validateAndUpdate!());
      },
      undo: () => {
        variable.setState({ regex: prevRegex });
        lastValueFrom(variable.validateAndUpdate!());
      },
    });
  };

  return (
    <Input
      id={id}
      defaultValue={regex}
      onBlur={onBlur}
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.nameFilter}
      placeholder={t('dashboard.sidebar.variable.datasource-options.name-filter-placeholder', 'Example: /^prod/')}
    />
  );
}
