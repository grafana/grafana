import { ref } from 'process';
import { useCallback, useRef } from 'react';
import { lastValueFrom } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { CustomVariable, VariableValueOption, VariableValueSingle } from '@grafana/scenes';
import { Button, Modal, Stack } from '@grafana/ui';
import { setPaneState } from 'app/features/explore/state/main';

import { VariableStaticOptionsForm, VariableStaticOptionsFormRef } from '../../components/VariableStaticOptionsForm';
import { VariableStaticOptionsFormAddButton } from '../../components/VariableStaticOptionsFormAddButton';

import { ValuesBuilder } from './ValuesBuilder';
import { ValuesPreview } from './ValuesPreview';

interface ModalEditorProps {
  variable: CustomVariable;
  isOpen: boolean;
  onClose: () => void;
}

export function ModalEditor({ variable, isOpen, onClose }: ModalEditorProps) {
  const formRef = useRef<VariableStaticOptionsFormRef | null>(null);

  const { query } = variable.useState();

  const options = variable.transformCsvStringToOptions(query, false).map(({ label, value }) => ({
    value,
    label: value === label ? '' : label,
  }));

  const escapeEntities = useCallback((text: VariableValueSingle) => String(text).trim().replaceAll(',', '\\,'), []);

  const formatOption = useCallback(
    (option: VariableValueOption) => {
      if (!option.label || option.label === option.value) {
        return escapeEntities(option.value);
      }

      return `${escapeEntities(option.label)} : ${escapeEntities(String(option.value))}`;
    },
    [escapeEntities]
  );

  const generateQuery = useCallback(
    (options: VariableValueOption[]) => options.map(formatOption).join(', '),
    [formatOption]
  );

  const handleOptionsChange = useCallback(
    async (options: VariableValueOption[]) => {
      variable.setState({ query: generateQuery(options) });
      await lastValueFrom(variable.validateAndUpdate!());
    },
    [variable, generateQuery]
  );

  const handleOnAdd = useCallback(() => formRef.current?.addItem(), []);

  return (
    <Modal
      title={t('dashboard.edit-pane.variable.custom-options.modal-title', 'Custom Variable')}
      isOpen={isOpen}
      onDismiss={onClose}
      closeOnBackdropClick={false}
      closeOnEscape={false}
    >
      <Stack direction="column" gap={2}>
        <VariableStaticOptionsForm options={options} onChange={handleOptionsChange} ref={formRef} isInModal />
        <ValuesPreview variable={variable} />
      </Stack>
      <Modal.ButtonRow leftItems={<VariableStaticOptionsFormAddButton onAdd={handleOnAdd} />}>
        <Button
          variant="secondary"
          fill="outline"
          onClick={onClose}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.closeButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.custom-options.close">Cancel</Trans>
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            variable.setState({ query: generateQuery(options) });
          }}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.custom-options.save">Save</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
