import { isObject } from 'lodash';
import { FormEvent, useState } from 'react';

import { CustomVariableModel, shallowCompare } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { FieldValidationMessage, Icon, RadioButtonGroup, Stack, TextLink, Tooltip } from '@grafana/ui';

import { SelectionOptionsForm } from './SelectionOptionsForm';
import { VariableLegend } from './VariableLegend';
import { VariableTextAreaField } from './VariableTextAreaField';

interface CustomVariableFormProps {
  query: string;
  valuesFormat?: CustomVariableModel['valuesFormat'];
  multi: boolean;
  allValue?: string | null;
  includeAll: boolean;
  allowCustomValue?: boolean;
  onQueryChange: (event: FormEvent<HTMLTextAreaElement>) => void;
  onMultiChange: (event: FormEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: FormEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
  onQueryBlur?: (event: FormEvent<HTMLTextAreaElement>) => void;
  onAllValueBlur?: (event: FormEvent<HTMLInputElement>) => void;
  onAllowCustomValueChange?: (event: FormEvent<HTMLInputElement>) => void;
  onValuesFormatChange?: (format: CustomVariableModel['valuesFormat']) => void;
}

export function CustomVariableForm({
  query,
  valuesFormat,
  multi,
  allValue,
  includeAll,
  allowCustomValue,
  onQueryChange,
  onMultiChange,
  onIncludeAllChange,
  onAllValueChange,
  onAllowCustomValueChange,
  onValuesFormatChange,
}: CustomVariableFormProps) {
  const [validationError, setValidationError] = useState<Error>();

  const onChangeFormat = (newFormat: CustomVariableModel['valuesFormat']) => {
    onValuesFormatChange?.(newFormat);
    setValidationError(undefined);
  };

  const onQueryBlur = (e: FormEvent<HTMLTextAreaElement>) => {
    if (valuesFormat === 'json') {
      setValidationError(validateJsonQuery(e.currentTarget.value));
    }
    onQueryChange(e);
  };

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.custom-variable-form.custom-options">Custom options</Trans>
      </VariableLegend>

      <Stack direction="row" gap={1}>
        <RadioButtonGroup
          value={valuesFormat}
          onChange={onChangeFormat}
          options={[
            {
              value: 'csv',
              label: t('dashboard-scene.custom-variable-form.name-values-separated-comma', 'Values separated by comma'),
            },
            {
              value: 'json',
              // TODO: add translation
              label: t('dashboard-scene.custom-variable-form.name-json-values', 'Object values in a JSON array'),
            },
          ]}
        />
        {valuesFormat === 'json' && (
          <Tooltip content={TooltipJsonFormat} placement="top" interactive>
            <Icon name="info-circle" />
          </Tooltip>
        )}
      </Stack>

      <VariableTextAreaField
        // we don't use a controlled component so we make sure the textarea content is cleared when changing format by providing a key
        key={valuesFormat}
        name=""
        placeholder={
          valuesFormat === 'json'
            ? // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              '[{ "text": "text1", "propA": "a1", "propB": "b1" },\n{ "text": "text2", "propA": "a2", "propB": "b2" }]'
            : // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              '1, 10, mykey : myvalue, myvalue, escaped\,value'
        }
        defaultValue={query}
        onBlur={onQueryBlur}
        required
        width={52}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput}
      />
      {validationError && <FieldValidationMessage>{validationError.message}</FieldValidationMessage>}

      <VariableLegend>
        <Trans i18nKey="dashboard-scene.custom-variable-form.selection-options">Selection options</Trans>
      </VariableLegend>
      <SelectionOptionsForm
        multi={multi}
        includeAll={includeAll}
        allValue={allValue}
        allowCustomValue={allowCustomValue}
        disableAllowCustomValue={valuesFormat === 'json'}
        disableCustomAllValue={valuesFormat === 'json'}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onAllowCustomValueChange={onAllowCustomValueChange}
      />
    </>
  );
}

function TooltipJsonFormat() {
  return (
    // TODO: add translation
    <Trans i18nKey="">
      Provide a JSON representing an array of objects, where each object can have any number of properties.
      <br />
      Check{' '}
      <TextLink href="https://grafana.com/docs/grafana/latest/variables/xxx" external>
        our docs
      </TextLink>{' '}
      for more information.
    </Trans>
  );
}

const validateJsonQuery = (rawQuwey: string): Error | undefined => {
  const query = rawQuwey.trim();
  if (!query) {
    return;
  }

  try {
    const options = JSON.parse(query);

    if (!Array.isArray(options)) {
      throw new Error('Invalid JSON array!');
    }

    if (!options.length) {
      return;
    }

    const keys = Object.keys(options[0]);
    if (!keys.length || !keys.some((k) => k === 'value')) {
      throw new Error('The objects in the array must have at least a "value" key!');
    }

    for (let i = 0; i < options.length; i += 1) {
      if (!isObject(options[i])) {
        throw new Error(`All items in the array must be objects. Item at index=${i} is incorrect!`);
      }

      if (!shallowCompare(keys, Object.keys(options[i]))) {
        throw new Error(`All objects in the array must have the same keys. Object at index=${i} is incorrect!`);
      }
    }

    return;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return error as Error;
  }
};
