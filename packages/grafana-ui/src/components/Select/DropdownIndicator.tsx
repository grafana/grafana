import React from 'react';

import { Icon } from '../Icon/Icon';

interface DropdownIndicatorProps {
  isOpen: boolean;
}

export const DropdownIndicator = ({ isOpen }: DropdownIndicatorProps) => {
  const icon = isOpen ? 'search' : 'angle-down';
  const size = isOpen ? 'sm' : 'md';
  return <Icon name={icon} size={size} />;
};
