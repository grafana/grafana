import { FormEvent, useMemo, useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { CustomVariableModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { CustomVariable } from '@grafana/scenes';
import { Button, FieldValidationMessage, Modal, Stack, TextArea } from '@grafana/ui';

import { dashboardEditActions } from '../../../../edit-pane/shared';
import { ValuesFormatSelector } from '../../components/CustomVariableForm';
import { VariableValuesPreview } from '../../components/VariableValuesPreview';

import { validateJsonQuery } from './CustomVariableEditor';
import { ModalEditorNonMultiProps } from './ModalEditorNonMultiProps';

interface ModalEditorProps {
  variable: CustomVariable;
  onClose: () => void;
}

export function ModalEditor(props: ModalEditorProps) {
  if (!config.featureToggles.multiPropsVariables) {
    return <ModalEditorNonMultiProps {...props} />;
  }
  return <ModalEditorMultiProps {...props} />;
}

function ModalEditorMultiProps(props: ModalEditorProps) {
  const {
    valuesFormat,
    query,
    queryValidationError,
    options,
    onCloseModal,
    onValuesFormatChange,
    onQueryChange,
    onSaveOptions,
  } = useModalEditor(props);

  return (
    <Modal
      title={t('dashboard.edit-pane.variable.custom-options.modal-title', 'Custom Variable')}
      isOpen={true}
      onDismiss={onCloseModal}
      closeOnBackdropClick={false}
      closeOnEscape={false}
    >
      <Stack direction="column" gap={2}>
        <ValuesFormatSelector valuesFormat={valuesFormat} onValuesFormatChange={onValuesFormatChange} />
        <div>
          <TextArea
            id={valuesFormat}
            key={valuesFormat}
            rows={4}
            defaultValue={query}
            onChange={onQueryChange}
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
          <VariableValuesPreview options={options} />
        </div>
      </Stack>
      <Modal.ButtonRow>
        <Button
          variant="secondary"
          fill="outline"
          onClick={onCloseModal}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.closeButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.custom-options.discard">Discard</Trans>
        </Button>
        <Button
          variant="primary"
          onClick={onSaveOptions}
          disabled={Boolean(queryValidationError)}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.applyButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.custom-options.apply">Apply</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

function useModalEditor({ variable, onClose }: ModalEditorProps) {
  const initialValuesFormatRef = useRef(variable.state.valuesFormat);
  const initialQueryRef = useRef(variable.state.query);
  const [valuesFormat, setValuesFormat] = useState(() => variable.state.valuesFormat);
  const [query, setQuery] = useState(() => variable.state.query);
  const [prevQuery, setPrevQuery] = useState('');
  const [queryValidationError, setQueryValidationError] = useState<Error>();

  const options = useMemo(() => {
    if (valuesFormat === 'csv') {
      return variable.transformCsvStringToOptions(query, false).map(({ label, value }) => ({
        value,
        label: value === label ? '' : label,
      }));
    } else {
      return variable.transformJsonToOptions(query);
    }
  }, [query, valuesFormat, variable]);

  return {
    valuesFormat,
    query,
    queryValidationError,
    options,
    onCloseModal: onClose,
    onValuesFormatChange(newFormat: CustomVariableModel['valuesFormat']) {
      setQuery(prevQuery);
      setValuesFormat(newFormat);
      setQueryValidationError(undefined);
      if (query !== prevQuery) {
        setPrevQuery(query);
      }
    },
    onQueryChange(event: FormEvent<HTMLTextAreaElement>) {
      setPrevQuery('');
      if (valuesFormat === 'json') {
        const validationError = validateJsonQuery(event.currentTarget.value);
        setQueryValidationError(validationError);
        if (validationError) {
          return;
        }
      }
      setQuery(event.currentTarget.value);
    },
    onSaveOptions() {
      dashboardEditActions.edit({
        source: variable,
        description: t('dashboard-scene.use-modal-editor.description.change-variable-query', 'Change variable query'),
        perform: async () => {
          if (!config.featureToggles.multiPropsVariables) {
            variable.setState({ valuesFormat: 'csv', query, value: undefined });
          } else {
            variable.setState({ valuesFormat, query, value: undefined });
          }

          if (valuesFormat === 'json') {
            variable.setState({ allowCustomValue: false, allValue: undefined });
          }

          await lastValueFrom(variable.validateAndUpdate!());
        },
        undo: async () => {
          variable.setState({
            valuesFormat: initialValuesFormatRef.current,
            query: initialQueryRef.current,
            value: undefined,
          });

          if (initialValuesFormatRef.current === 'json') {
            variable.setState({ allowCustomValue: false });
            variable.setState({ allValue: undefined });
          }

          await lastValueFrom(variable.validateAndUpdate!());
        },
      });
      onClose();
    },
  };
}
