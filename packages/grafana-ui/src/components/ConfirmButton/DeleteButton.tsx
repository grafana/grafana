import React, { FC } from 'react';
import { ConfirmButton } from './ConfirmButton';
import { ComponentSize } from '../../types/size';
import { Button } from '../Button';

interface Props {
  size?: ComponentSize;
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
