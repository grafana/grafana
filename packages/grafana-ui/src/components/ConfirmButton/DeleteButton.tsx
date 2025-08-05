import { t } from '@grafana/i18n';

import { ComponentSize } from '../../types/size';
import { Button } from '../Button/Button';

import { ConfirmButton } from './ConfirmButton';

export interface Props {
  /** Confirm action callback */
  onConfirm(): void;
  /** Button size */
  size?: ComponentSize;
  /** Disable button click action */
  disabled?: boolean;
  'aria-label'?: string;
  /** Close after delete button is clicked */
  closeOnConfirm?: boolean;
}

export const DeleteButton = ({ size, disabled, onConfirm, 'aria-label': ariaLabel, closeOnConfirm }: Props) => {
  return (
    <ConfirmButton
      confirmText={t('grafana-ui.confirm-button.confirmText-delete', 'Delete')}
      confirmVariant="destructive"
      size={size || 'md'}
      disabled={disabled}
      onConfirm={onConfirm}
      closeOnConfirm={closeOnConfirm}
    >
      <Button
        aria-label={ariaLabel ?? t('grafana-ui.confirm-button.aria-label-delete', 'Delete')}
        variant="destructive"
        icon="times"
        size={size || 'sm'}
      />
    </ConfirmButton>
  );
};
