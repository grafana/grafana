import { FormEvent } from 'react';

import { CustomVariableModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, FieldValidationMessage, Icon, RadioButtonGroup, Stack, TextLink, Tooltip } from '@grafana/ui';

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
  queryValidationError?: Error;
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
  queryValidationError,
  onQueryChange,
  onMultiChange,
  onIncludeAllChange,
  onAllValueChange,
  onAllowCustomValueChange,
  onValuesFormatChange,
}: CustomVariableFormProps) {
  if (!config.featureToggles.multiPropsVariables) {
    return (
      <CustomVariableFormNonMultiProps
        displayMultiPropsWarningBanner={valuesFormat === 'json'}
        query={query}
        multi={multi}
        allValue={allValue}
        includeAll={includeAll}
        allowCustomValue={allowCustomValue}
        onQueryChange={onQueryChange}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onAllowCustomValueChange={onAllowCustomValueChange}
      />
    );
  }

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.custom-variable-form.custom-options">Custom options</Trans>
      </VariableLegend>

      <ValuesFormatSelector valuesFormat={valuesFormat} onValuesFormatChange={onValuesFormatChange} />

      <VariableTextAreaField
        // we don't use a controlled component so we make sure the textarea content is cleared when changing format by providing a key
        key={valuesFormat}
        name=""
        placeholder={
          valuesFormat === 'json'
            ? // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              '[{ "text":"text1", "value":"val1", "propA":"a1", "propB":"b1" },\n{ "text":"text2", "value":"val2", "propA":"a2", "propB":"b2" }]'
            : // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              '1, 10, mykey : myvalue, myvalue, escaped\,value'
        }
        defaultValue={query}
        onBlur={onQueryChange}
        required
        width={52}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput}
      />
      {queryValidationError && <FieldValidationMessage>{queryValidationError.message}</FieldValidationMessage>}

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

interface ValuesFormatSelectorProps {
  valuesFormat?: CustomVariableModel['valuesFormat'];
  onValuesFormatChange?: (format: CustomVariableModel['valuesFormat']) => void;
}

export function ValuesFormatSelector({ valuesFormat, onValuesFormatChange }: ValuesFormatSelectorProps) {
  return (
    <Stack direction="row" gap={1}>
      <RadioButtonGroup
        value={valuesFormat}
        onChange={onValuesFormatChange}
        options={[
          {
            value: 'csv',
            label: config.featureToggles.multiPropsVariables
              ? t('dashboard-scene.custom-variable-form.name-csv-values', 'CSV')
              : t('dashboard-scene.custom-variable-form.name-values-separated-comma', 'Values separated by comma'),
          },
          {
            value: 'json',
            label: t('dashboard-scene.custom-variable-form.name-json-values', 'JSON'),
          },
        ]}
      />
      {valuesFormat === 'json' && (
        <Tooltip
          content={
            <Trans i18nKey="dashboard-scene.custom-variable-form.json-values-tooltip">
              Provide a JSON representing an array of objects, where each object can have any number of properties.
              <br />
              Check{' '}
              <TextLink href="https://grafana.com/docs/grafana/latest/variables/xxx" external>
                our docs
              </TextLink>{' '}
              for more information.
            </Trans>
          }
          placement="top"
          interactive
        >
          <Icon name="info-circle" />
        </Tooltip>
      )}
    </Stack>
  );
}

function CustomVariableFormNonMultiProps({
  displayMultiPropsWarningBanner,
  query,
  multi,
  allValue,
  includeAll,
  allowCustomValue,
  onQueryChange,
  onMultiChange,
  onIncludeAllChange,
  onAllValueChange,
  onAllowCustomValueChange,
}: CustomVariableFormProps & { displayMultiPropsWarningBanner: boolean }) {
  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.custom-variable-form.custom-options">Custom options</Trans>
      </VariableLegend>

      {displayMultiPropsWarningBanner && (
        <div style={{ maxWidth: '25%' }}>
          {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
          <Alert severity="warning" title="Custom options with multi-properties are unavailable">
            This feature is temporarily disabled, sorry for any inconvenience. Please recreate these options without
            multi-properties.
          </Alert>
        </div>
      )}

      <VariableTextAreaField
        name={t('dashboard-scene.custom-variable-form.name-values-separated-comma', 'Values separated by comma')}
        defaultValue={query}
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        placeholder="1, 10, mykey : myvalue, myvalue, escaped\,value"
        onBlur={onQueryChange}
        required
        width={52}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput}
      />
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.custom-variable-form.selection-options">Selection options</Trans>
      </VariableLegend>
      <SelectionOptionsForm
        multi={multi}
        includeAll={includeAll}
        allValue={allValue}
        allowCustomValue={allowCustomValue}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onAllowCustomValueChange={onAllowCustomValueChange}
      />
    </>
  );
}
