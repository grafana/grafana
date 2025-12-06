import { useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { CustomVariable, VariableValueOption, VariableValueSingle } from '@grafana/scenes';
import { Button, Modal, Stack } from '@grafana/ui';

import { dashboardEditActions } from '../../../../edit-pane/shared';
import { VariableStaticOptionsForm, VariableStaticOptionsFormRef } from '../../components/VariableStaticOptionsForm';
import { VariableStaticOptionsFormAddButton } from '../../components/VariableStaticOptionsFormAddButton';
import { VariableValuesPreview } from '../../components/VariableValuesPreview';

interface ModalEditorProps {
  variable: CustomVariable;
  onClose: () => void;
}

export function ModalEditor(props: ModalEditorProps) {
  const { formRef, onCloseModal, options, onChangeOptions, onAddNewOption, onSaveOptions } = useModalEditor(props);

  return (
    <Modal
      title={t('dashboard.edit-pane.variable.custom-options.modal-title', 'Custom Variable')}
      isOpen={true}
      onDismiss={onCloseModal}
      closeOnBackdropClick={false}
      closeOnEscape={false}
    >
      <Stack direction="column" gap={2}>
        <VariableStaticOptionsForm options={options} onChange={onChangeOptions} ref={formRef} isInModal />
        <VariableValuesPreview options={options} />
      </Stack>
      <Modal.ButtonRow leftItems={<VariableStaticOptionsFormAddButton onAdd={onAddNewOption} />}>
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
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.applyButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.custom-options.apply">Apply</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

function useModalEditor({ variable, onClose }: ModalEditorProps) {
  const { query } = variable.state;
  const [options, setOptions] = useState(() => transformQueryToOptions(variable, query));
  const initialQueryRef = useRef(query);
  const formRef = useRef<VariableStaticOptionsFormRef | null>(null);

  return {
    formRef,
    onCloseModal: onClose,
    options,
    onChangeOptions: setOptions,
    onAddNewOption() {
      formRef.current?.addItem();
    },
    onSaveOptions() {
      dashboardEditActions.edit({
        source: variable,
        description: t('dashboard.edit-pane.variable.custom-options.change-value', 'Change variable value'),
        perform: () => {
          variable.setState({ query: transformOptionsToQuery(options) });
          lastValueFrom(variable.validateAndUpdate!());
        },
        undo: () => {
          variable.setState({ query: initialQueryRef.current });
          lastValueFrom(variable.validateAndUpdate!());
        },
      });

      onClose();
    },
  };
}

const transformQueryToOptions = (variable: ModalEditorProps['variable'], query: string) =>
  variable.transformCsvStringToOptions(query, false).map(({ label, value }) => ({
    value,
    label: value === label ? '' : label,
  }));

const formatOption = (option: VariableValueOption) => {
  if (!option.label || option.label === option.value) {
    return escapeEntities(option.value);
  }
  return `${escapeEntities(option.label)} : ${escapeEntities(String(option.value))}`;
};

const escapeEntities = (text: VariableValueSingle) => String(text).trim().replaceAll(',', '\\,');

const transformOptionsToQuery = (options: VariableValueOption[]) => options.map(formatOption).join(', ');
