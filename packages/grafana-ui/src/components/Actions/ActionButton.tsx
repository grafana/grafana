import { useState } from 'react';

import { ActionModel, ActionVariable, Field } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { t } from '../../utils/i18n';
import { Button, ButtonProps } from '../Button';

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
  const actionHasVariables = action.variables && action.variables.length > 0;

  console.log('showConfirm', showConfirm);

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setShowConfirm(true)}
        {...buttonProps}
        style={{ width: 'fit-content', backgroundColor, color: textColor }}
      >
        {action.title}
      </Button>

      {actionHasVariables && showConfirm && (
        //onDismiss={() => setShowConfirm(false)}
        <VariablesInputModal onDismiss={() => console.log('on dismiss')} action={action} />
      )}

      {/*{showConfirm && (*/}
      {/*  <ConfirmModal*/}
      {/*    isOpen={true}*/}
      {/*    title={t('grafana-ui.action-editor.button.confirm-action', 'Confirm action')}*/}
      {/*    body={action.confirmation}*/}
      {/*    confirmText={t('grafana-ui.action-editor.button.confirm', 'Confirm')}*/}
      {/*    confirmButtonVariant="primary"*/}
      {/*    onConfirm={() => {*/}
      {/*      setShowConfirm(false);*/}
      {/*      action.onClick(new MouseEvent('click'));*/}
      {/*    }}*/}
      {/*    onDismiss={() => {*/}
      {/*      setShowConfirm(false);*/}
      {/*    }}*/}
      {/*  />*/}
      {/*)}*/}
    </>
  );
}
