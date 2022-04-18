import React from 'react';

import { Icon } from '../Icon/Icon';

interface DropdownIndicatorProps {
  isOpen: boolean;
  hidden?: boolean;
}

export const DropdownIndicator: React.FC<DropdownIndicatorProps> = ({ isOpen, hidden = false }) => {
  if (hidden) {
    return <></>;
  }
  const icon = isOpen ? 'angle-up' : 'angle-down';
  return <Icon name={icon} />;
};
