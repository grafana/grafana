import React, { FC } from 'react';
import { ConfirmButton } from './ConfirmButton';
import { Button } from '../Button/Button';
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
      confirmVariant="danger"
      size={size || 'md'}
      disabled={disabled}
      onConfirm={onConfirm}
    >
      <Button variant="danger" icon="fa fa-remove" size={size || 'sm'} />
    </ConfirmButton>
  );
};
