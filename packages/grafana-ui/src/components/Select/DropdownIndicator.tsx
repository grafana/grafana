import React from 'react';
import { Icon } from '../Icon/Icon';

interface DropdownIndicatorProps {
  isOpen: boolean;
}

export const DropdownIndicator: React.FC<DropdownIndicatorProps> = ({ isOpen }) => {
  const icon = isOpen ? 'angle-up' : 'angle-down';
  return <Icon name={icon} />;
};
