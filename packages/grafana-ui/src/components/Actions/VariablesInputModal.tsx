import { css } from '@emotion/css';
import { useState } from 'react';

import { ActionModel, ActionVariable, ActionVariableInput } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { t } from '../../utils/i18n';
import { Button } from '../Button/Button';
import { Field } from '../Forms/Field';
import { FieldSet } from '../Forms/FieldSet';
import { Input } from '../Input/Input';
import { Modal } from '../Modal/Modal';

interface Props {
  action: ActionModel;
  onDismiss: () => void;
  onShowConfirm: () => void;
  getVariables: (vars: ActionVariableInput) => void;
}

/**
 * @internal
 */
export function VariablesInputModal({ action, onDismiss, onShowConfirm, getVariables }: Props) {
  const styles = useStyles2(getStyles);

  const [variables, setVariables] = useState<ActionVariable[]>(action.variables || []);
  const [inputValues, setInputValues] = useState<ActionVariableInput>({});

  const handleVariableChange = (index: number, key: string, value: string) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], [key]: value };
    setVariables(newVariables);
    setInputValues({ ...inputValues, [`${key}`]: value });

    getVariables({ ...inputValues, [`${key}`]: value });
  };

  const onModalContinue = () => {
    onDismiss();
    onShowConfirm();
  };

  return (
    <Modal
      isOpen={true}
      title={t('grafana-ui.action-editor.button.action-variables-title', 'Action variables')}
      onDismiss={onDismiss}
      className={styles.variablesModal}
    >
      <FieldSet>
        {variables.map((variable, index) => (
          <Field key={index} label={variable.name}>
            <Input
              type="text"
              value={inputValues[`${variable.key}`] ?? ''}
              onChange={(e) => handleVariableChange(index, variable.key, e.currentTarget.value)}
              placeholder={t('grafana-ui.action-editor.button.variable-value-placeholder', 'Value')}
              width={20}
            />
          </Field>
        ))}
      </FieldSet>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss}>
          {t('grafana-ui.action-editor.close', 'Close')}
        </Button>
        <Button variant="primary" onClick={onModalContinue}>
          {t('grafana-ui.action-editor.continue', 'Continue')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = () => {
  return {
    variablesModal: css({
      zIndex: 10000,
    }),
  };
};
