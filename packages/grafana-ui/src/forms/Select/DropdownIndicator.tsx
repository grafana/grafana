import React from 'react';
import { Icon } from '../../components/Icon/Icon';

interface DropdownIndicatorProps {
  isOpen: boolean;
}

export const DropdownIndicator: React.FC<DropdownIndicatorProps> = ({ isOpen }) => {
  const icon = isOpen ? 'caret-up' : 'caret-down';
  return <Icon name={icon} />;
};
