import { useState } from 'react';

import { ActionModel, Field } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';

import { useTheme2 } from '../../themes';
import { Button, ButtonProps } from '../Button';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';

type ActionButtonProps = ButtonProps & {
  action: ActionModel<Field>;
};

/**
 * @internal
 */
export function ActionButton({ action, ...buttonProps }: ActionButtonProps) {
  const { t } = useTranslate();
  const theme = useTheme2();
  const backgroundColor = action.style.backgroundColor || theme.colors.secondary.main;
  const textColor = theme.colors.getContrastText(backgroundColor);

  const [showConfirm, setShowConfirm] = useState(false);

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
      {showConfirm && (
        <ConfirmModal
          isOpen={true}
          title={t('grafana-ui.action-editor.button.confirm-action', 'Confirm action')}
          body={action.confirmation}
          confirmText={t('grafana-ui.action-editor.button.confirm', 'Confirm')}
          confirmButtonVariant="primary"
          onConfirm={() => {
            setShowConfirm(false);
            action.onClick(new MouseEvent('click'));
          }}
          onDismiss={() => {
            setShowConfirm(false);
          }}
        />
      )}
    </>
  );
}
