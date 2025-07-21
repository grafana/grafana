import { css } from '@emotion/css';

import { ActionModel, ActionVariableInput } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { Field } from '../Forms/Field';
import { FieldSet } from '../Forms/FieldSet';
import { Input } from '../Input/Input';
import { Modal } from '../Modal/Modal';

interface Props {
  action: ActionModel;
  onDismiss: () => void;
  onShowConfirm: () => void;
  variables: ActionVariableInput;
  setVariables: (vars: ActionVariableInput) => void;
}

/**
 * @internal
 */
export function VariablesInputModal({ action, onDismiss, onShowConfirm, variables, setVariables }: Props) {
  const styles = useStyles2(getStyles);

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
        {action.variables!.map((variable) => (
          <Field key={variable.name} label={variable.name}>
            <Input
              type="text"
              value={variables[variable.key] ?? ''}
              onChange={(e) => {
                setVariables({ ...variables, [variable.key]: e.currentTarget.value });
              }}
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
