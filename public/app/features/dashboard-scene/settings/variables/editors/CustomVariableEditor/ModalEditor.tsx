import { FormEvent, useCallback, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { CustomVariableModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { CustomVariable } from '@grafana/scenes';
import { Button, FieldValidationMessage, Modal, Stack, TextArea } from '@grafana/ui';

import { ValuesFormatSelector } from '../../components/CustomVariableForm';
import { VariableValuesPreview } from '../../components/VariableValuesPreview';

import { validateJsonQuery } from './CustomVariableEditor';

interface ModalEditorProps {
  variable: CustomVariable;
  isOpen: boolean;
  onClose: () => void;
}

export function ModalEditor({ variable, isOpen, onClose }: ModalEditorProps) {
  const { query, valuesFormat, isMulti } = variable.useState();
  const [prevQuery, setPrevQuery] = useState('');
  const [queryValidationError, setQueryValidationError] = useState<Error>();

  const onValuesFormatChange = useCallback(
    async (format: CustomVariableModel['valuesFormat']) => {
      variable.setState({ query: prevQuery });
      variable.setState({ value: isMulti ? [] : undefined });
      variable.setState({ valuesFormat: format });
      variable.setState({ allowCustomValue: false });
      variable.setState({ allValue: undefined });

      await lastValueFrom(variable.validateAndUpdate());

      setQueryValidationError(undefined);
      if (query !== prevQuery) {
        setPrevQuery(query);
      }
    },
    [isMulti, prevQuery, query, variable]
  );

  const onQueryChange = useCallback(
    async (event: FormEvent<HTMLTextAreaElement>) => {
      setPrevQuery('');

      if (valuesFormat === 'json') {
        const validationError = validateJsonQuery(event.currentTarget.value);
        setQueryValidationError(validationError);
        if (validationError) {
          return;
        }
      }

      variable.setState({ query: event.currentTarget.value });
      await lastValueFrom(variable.validateAndUpdate());
    },
    [valuesFormat, variable]
  );

  const optionsForSelect = variable.getOptionsForSelect(false);
  const hasJsonValuesFormat = variable.state.valuesFormat === 'json';
  const hasMultiProps = hasJsonValuesFormat || optionsForSelect.every((o) => Boolean(o.properties));

  return (
    <Modal
      title={t('dashboard.edit-pane.variable.custom-options.modal-title', 'Custom Variable')}
      isOpen={isOpen}
      onDismiss={onClose}
    >
      <Stack direction="column" gap={2}>
        <ValuesFormatSelector valuesFormat={valuesFormat} onValuesFormatChange={onValuesFormatChange} />
        <div>
          <TextArea
            id={valuesFormat}
            key={valuesFormat}
            rows={4}
            defaultValue={query}
            onBlur={onQueryChange}
            placeholder={
              valuesFormat === 'json'
                ? // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  '[{ "text":"text1", "value":"val1", "propA":"a1", "propB":"b1" },\n{ "text":"text2", "value":"val2", "propA":"a2", "propB":"b2" }]'
                : // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  '1, 10, mykey : myvalue, myvalue, escaped\,value'
            }
            required
            data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput}
          />
          {queryValidationError && <FieldValidationMessage>{queryValidationError.message}</FieldValidationMessage>}
        </div>
        <div>
          <VariableValuesPreview options={optionsForSelect} hasMultiProps={hasMultiProps} />
        </div>
      </Stack>
      <Modal.ButtonRow>
        <Button
          variant="secondary"
          fill="outline"
          onClick={onClose}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.closeButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.custom-options.close">Close</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
