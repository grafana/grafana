import { useCallback, useRef, useState } from 'react';
import { useEffectOnce } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { CustomVariable, VariableValueOption, VariableValueSingle } from '@grafana/scenes';
import { Button, Modal, Stack } from '@grafana/ui';

import { dashboardEditActions } from '../../../../edit-pane/shared';
import { VariableStaticOptionsForm, VariableStaticOptionsFormRef } from '../../components/VariableStaticOptionsForm';
import { VariableStaticOptionsFormAddButton } from '../../components/VariableStaticOptionsFormAddButton';

import { ValuesPreview } from './ValuesPreview';

interface ModalEditorProps {
  variable: CustomVariable;
  onClose: () => void;
}

export function ModalEditor({ variable, onClose }: ModalEditorProps) {
  const { query } = variable.useState();
  const [initialQuery, setInitialQuery] = useState(query);

  useEffectOnce(() => {
    setInitialQuery(query);
  });

  const transformQueryToOptions = useCallback(
    (query: string) =>
      variable.transformCsvStringToOptions(query, false).map(({ label, value }) => ({
        value,
        label: value === label ? '' : label,
      })),
    [variable]
  );

  const [options, setOptions] = useState(transformQueryToOptions(query));

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

  const onSave = useCallback(async () => {
    const query = generateQuery(options);

    dashboardEditActions.edit({
      source: variable,
      description: t('dashboard.edit-pane.variable.custom-options.change-value', 'Change variable value'),
      perform: () => {
        variable.setState({ query });
        lastValueFrom(variable.validateAndUpdate!());
      },
      undo: () => {
        variable.setState({ query: initialQuery });
        lastValueFrom(variable.validateAndUpdate!());
      },
    });

    onClose();
  }, [generateQuery, options, variable, onClose, initialQuery]);

  const formRef = useRef<VariableStaticOptionsFormRef | null>(null);
  const handleOnAdd = useCallback(() => formRef.current?.addItem(), []);

  return (
    <Modal
      title={t('dashboard.edit-pane.variable.custom-options.modal-title', 'Custom Variable')}
      isOpen={true}
      onDismiss={onClose}
      closeOnBackdropClick={false}
      closeOnEscape={false}
    >
      <Stack direction="column" gap={2}>
        <VariableStaticOptionsForm options={options} onChange={setOptions} ref={formRef} isInModal />
        <ValuesPreview options={options} />
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
        <Button variant="primary" onClick={onSave}>
          <Trans i18nKey="dashboard.edit-pane.variable.custom-options.save">Save</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
