import { useCallback, useRef } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { CustomVariable } from '@grafana/scenes';
import { Button, Modal, Stack } from '@grafana/ui';

import { VariableStaticOptionsFormRef } from '../../components/VariableStaticOptionsForm';
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

  const handleOnAdd = useCallback(() => formRef.current?.addItem(), []);

  return (
    <Modal
      title={t('dashboard.edit-pane.variable.custom-options.modal-title', 'Custom Variable')}
      isOpen={isOpen}
      onDismiss={onClose}
    >
      <Stack direction="column" gap={2}>
        <ValuesBuilder variable={variable} ref={formRef} />
        <ValuesPreview variable={variable} />
      </Stack>
      <Modal.ButtonRow leftItems={<VariableStaticOptionsFormAddButton onAdd={handleOnAdd} />}>
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
