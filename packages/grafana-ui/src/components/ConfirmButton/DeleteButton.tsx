import React, { FC } from 'react';
import { ConfirmButton } from './ConfirmButton';
import { Button } from '../Forms/Button';
import { ButtonSize } from '../Button/types';

interface Props {
  size?: ButtonSize;
  disabled?: boolean;
  onConfirm(): void;
}

export const DeleteButton: FC<Props> = ({ size, disabled, onConfirm }) => {
  return (
    <ConfirmButton
      confirmText="Delete"
      confirmVariant="destructive"
      size={size || 'md'}
      disabled={disabled}
      onConfirm={onConfirm}
    >
      <Button variant="destructive" icon="fa fa-remove" size={size || 'sm'} />
    </ConfirmButton>
  );
};
