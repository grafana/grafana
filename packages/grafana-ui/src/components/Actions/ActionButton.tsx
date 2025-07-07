import { useState } from 'react';

import { ActionModel, Field, ActionVariableInput } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Button, ButtonProps } from '../Button/Button';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';

import { VariablesInputModal } from './VariablesInputModal';

type ActionButtonProps = ButtonProps & {
  action: ActionModel<Field>;
};

/**
 * @internal
 */
export function ActionButton({ action, ...buttonProps }: ActionButtonProps) {
  const theme = useTheme2();
  const backgroundColor = action.style.backgroundColor || theme.colors.secondary.main;
  const textColor = theme.colors.getContrastText(backgroundColor);

  const [showConfirm, setShowConfirm] = useState(false);

  // Action variables
  const [showVarsModal, setShowVarsModal] = useState(false);
  const [actionVars, setActionVars] = useState<ActionVariableInput>({});

  const actionHasVariables = action.variables && action.variables.length > 0;

  const onClick = () => {
    if (actionHasVariables) {
      setShowVarsModal(true);
    } else {
      setShowConfirm(true);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={onClick}
        {...buttonProps}
        style={{ width: 'fit-content', backgroundColor, color: textColor }}
      >
        {action.title}
      </Button>

      {actionHasVariables && showVarsModal && (
        <VariablesInputModal
          onDismiss={() => setShowVarsModal(false)}
          action={action}
          onShowConfirm={() => setShowConfirm(true)}
          variables={actionVars}
          setVariables={setActionVars}
        />
      )}

      {showConfirm && (
        <ConfirmModal
          isOpen={true}
          title={t('grafana-ui.action-editor.button.confirm-action', 'Confirm action')}
          body={action.confirmation(actionVars)}
          confirmText={t('grafana-ui.action-editor.button.confirm', 'Confirm')}
          confirmButtonVariant="primary"
          onConfirm={() => {
            setShowConfirm(false);
            action.onClick(new MouseEvent('click'), null, actionVars);
          }}
          onDismiss={() => {
            setShowConfirm(false);
          }}
        />
      )}
    </>
  );
}
