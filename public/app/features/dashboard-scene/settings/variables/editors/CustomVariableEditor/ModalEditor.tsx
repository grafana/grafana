import { FormEvent, useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { CustomVariableModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { CustomVariable } from '@grafana/scenes';
import { Button, FieldValidationMessage, Modal, Stack, TextArea } from '@grafana/ui';
import { dashboardEditActions } from 'app/features/dashboard-scene/edit-pane/shared';

import { ValuesFormatSelector } from '../../components/CustomVariableForm';
import { VariableValuesPreview } from '../../components/VariableValuesPreview';

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
    previewOptions,
    valuesFormat,
    query,
    queryValidationError,
    onCloseModal,
    onValuesFormatChange,
    onQueryChange,
    onSaveOptions,
  } = useModalEditor(props);

  return (
    <Modal
      title={t('dashboard.edit-pane.variable.custom-options.modal-title', 'Custom options')}
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
          <VariableValuesPreview options={previewOptions} staticOptions={[]} />
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

export function useDraftVariable(variable: CustomVariable) {
  const draftVariableRef = useRef<CustomVariable>();
  if (!draftVariableRef.current) {
    draftVariableRef.current = new CustomVariable(variable.state);
  }
  const initialStateRef = useRef({ ...variable.state });
  return { draftVariable: draftVariableRef.current, initialState: initialStateRef.current };
}

function useModalEditor({ variable, onClose }: ModalEditorProps) {
  const { draftVariable, initialState } = useDraftVariable(variable);
  const { valuesFormat, query, options } = draftVariable.useState();
  const [queryValidationError, setQueryValidationError] = useState<Error>();
  const [stashedQuery, setStashedQuery] = useState('');

  const updateDraftState = async (newState: Partial<typeof draftVariable.state>) => {
    draftVariable.setState(newState);
    try {
      await lastValueFrom(draftVariable.validateAndUpdate());
      setQueryValidationError(undefined);
    } catch (error) {
      setQueryValidationError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  return {
    previewOptions: options,
    valuesFormat,
    query,
    queryValidationError,
    onCloseModal: onClose,
    async onValuesFormatChange(newFormat: CustomVariableModel['valuesFormat']) {
      const nextQuery = stashedQuery;
      if (query !== stashedQuery) {
        setStashedQuery(query);
      }
      await updateDraftState({ valuesFormat: newFormat, query: nextQuery });
    },
    async onQueryChange(event: FormEvent<HTMLTextAreaElement>) {
      setStashedQuery('');
      await updateDraftState({ query: event.currentTarget.value });
    },
    onSaveOptions() {
      dashboardEditActions.edit({
        source: variable,
        description: t('dashboard-scene.use-modal-editor.description.change-variable-query', 'Change variable query'),
        perform: async () => {
          if (!config.featureToggles.multiPropsVariables) {
            variable.setState({ valuesFormat: 'csv', query });
          } else {
            variable.setState({ valuesFormat, query });
          }

          if (valuesFormat === 'json') {
            variable.setState({ allowCustomValue: false, allValue: undefined });
          }

          await lastValueFrom(variable.validateAndUpdate!());
          onClose();
        },
        undo: async () => {
          variable.setState(initialState);
          await lastValueFrom(variable.validateAndUpdate!());
        },
      });
    },
  };
}
