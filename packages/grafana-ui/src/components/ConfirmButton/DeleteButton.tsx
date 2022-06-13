import React, { FC } from 'react';

import { ComponentSize } from '../../types/size';
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
}

export const DeleteButton: FC<Props> = ({ size, disabled, onConfirm, 'aria-label': ariaLabel }) => {
  return (
    <ConfirmButton
      confirmText="Delete"
      confirmVariant="destructive"
      size={size || 'md'}
      disabled={disabled}
      onConfirm={onConfirm}
    >
      <Button aria-label={ariaLabel} variant="destructive" icon="times" size={size || 'sm'} />
    </ConfirmButton>
  );
};
