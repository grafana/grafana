import { FormEvent, useCallback, useState } from 'react';

import { CustomVariableModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { CustomVariable, SceneVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { CustomVariableForm } from '../../components/CustomVariableForm';

import { PaneItem } from './PaneItem';
import { validateJsonQuery } from './customVariableQueryUtils';

interface CustomVariableEditorProps {
  variable: CustomVariable;
  onRunQuery: () => void;
}

export function CustomVariableEditor({ variable, onRunQuery }: CustomVariableEditorProps) {
  const { query, valuesFormat, isMulti, allValue, includeAll, allowCustomValue } = variable.useState();
  const [queryValidationError, setQueryValidationError] = useState<Error>();

  const [prevQuery, setPrevQuery] = useState('');
  const onValuesFormatChange = useCallback(
    (format: CustomVariableModel['valuesFormat']) => {
      variable.setState({ query: prevQuery });
      variable.setState({ value: isMulti ? [] : undefined });
      variable.setState({ valuesFormat: format });
      variable.setState({ allowCustomValue: false });
      variable.setState({ allValue: undefined });
      onRunQuery();

      setQueryValidationError(undefined);
      if (query !== prevQuery) {
        setPrevQuery(query);
      }
    },
    [isMulti, onRunQuery, prevQuery, query, variable]
  );

  const onMultiChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ isMulti: event.currentTarget.checked });
    },
    [variable]
  );

  const onIncludeAllChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ includeAll: event.currentTarget.checked });
    },
    [variable]
  );

  const onQueryChange = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      setPrevQuery('');

      if (config.featureToggles.multiPropsVariables && valuesFormat === 'json') {
        const validationError = validateJsonQuery(event.currentTarget.value.trim());
        setQueryValidationError(validationError);
        if (validationError) {
          return;
        }
      }

      if (!config.featureToggles.multiPropsVariables) {
        variable.setState({ valuesFormat: 'csv' });
      }

      variable.setState({ query: event.currentTarget.value });
      onRunQuery();
    },
    [valuesFormat, variable, onRunQuery]
  );

  const onAllValueChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ allValue: event.currentTarget.value });
    },
    [variable]
  );

  const onAllowCustomValueChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ allowCustomValue: event.currentTarget.checked });
    },
    [variable]
  );

  return (
    <CustomVariableForm
      query={query ?? ''}
      valuesFormat={valuesFormat ?? 'csv'}
      multi={!!isMulti}
      allValue={allValue ?? ''}
      includeAll={!!includeAll}
      allowCustomValue={allowCustomValue}
      queryValidationError={queryValidationError}
      onQueryChange={onQueryChange}
      onMultiChange={onMultiChange}
      onIncludeAllChange={onIncludeAllChange}
      onAllValueChange={onAllValueChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
      onValuesFormatChange={onValuesFormatChange}
    />
  );
}

export function getCustomVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof CustomVariable)) {
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      title: t('dashboard.edit-pane.variable.custom-options.values', 'Values separated by comma'),
      id: 'custom-variable-values',
      render: ({ props }) => <PaneItem id={props.id} variable={variable} />,
    }),
  ];
}
