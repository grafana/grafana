import React from 'react';
import { IconButton } from '../IconButton/IconButton';
import { GetToggleButtonPropsOptions } from 'downshift';

interface DropdownButtonProps {
  isOpen: boolean;
  onClick: () => void;
  getToggleButtonProps: (options?: GetToggleButtonPropsOptions) => void;
  disabled?: boolean;
}

export const DropdownButton: React.FC<DropdownButtonProps> = ({ isOpen, onClick, disabled, getToggleButtonProps }) => (
  <IconButton
    disabled={disabled}
    name={isOpen ? 'angle-up' : 'angle-down'}
    {...getToggleButtonProps({
      onClick,
    })}
    aria-label={'Toggle menu'}
  />
);
