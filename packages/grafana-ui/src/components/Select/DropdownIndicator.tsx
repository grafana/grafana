import { DropdownIndicatorProps } from 'react-select';

import { Icon } from '../Icon/Icon';

export function DropdownIndicator({ selectProps }: DropdownIndicatorProps) {
  const isOpen = selectProps.menuIsOpen;
  const icon = isOpen ? 'search' : 'angle-down';
  const size = 'md';
  return <Icon name={icon} size={size} />;
}
