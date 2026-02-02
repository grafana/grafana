import { ComponentSize } from '../../types/size';
import { t } from '../../utils/i18n';
import { Button } from '../Button';

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
      /*BMC Change: To enable localization for below text*/
      confirmText={t('bmcgrafana.grafana-ui.delete-button.confirm-text', 'Delete')}
      confirmVariant="destructive"
      size={size || 'md'}
      disabled={disabled}
      onConfirm={onConfirm}
      closeOnConfirm={closeOnConfirm}
    >
      <Button aria-label={ariaLabel} variant="destructive" icon="times" size={size || 'sm'} />
    </ConfirmButton>
  );
};
