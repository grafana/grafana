import { DropdownIndicatorProps } from 'react-select';

import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';

export function DropdownIndicator({ selectProps }: DropdownIndicatorProps) {
  const isOpen = selectProps.menuIsOpen;
  const icon = isOpen ? 'search' : 'angle-down';
  const size = 'md';

  if (selectProps.isLoading) {
    return <Spinner inline />;
  }

  return <Icon name={icon} size={size} />;
}
