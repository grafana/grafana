import React from 'react';
import { DropdownIndicatorProps } from 'react-select';

import { Icon } from '../Icon/Icon';

export function DropdownIndicator({ selectProps }: DropdownIndicatorProps) {
  const isOpen = selectProps.menuIsOpen;
  const icon = isOpen ? 'search' : 'angle-down';
  const size = isOpen ? 'sm' : 'md';
  return <Icon name={icon} size={size} />;
}

// Exported from @grafana ui for backwards compatibility
export function DropdownIndicatorLegacy(props: { isOpen: boolean }) {
  // @ts-expect-error
  return <DropdownIndicator selectProps={{ menuIsOpen: props.isOpen }} />;
}
