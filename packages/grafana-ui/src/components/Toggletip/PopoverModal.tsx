import React from 'react';

import { Toggletip, ToggletipProps } from './Toggletip';

interface PopoverModalProps extends Omit<ToggletipProps, 'theme'> {}

export function PopoverModal({ children, ...otherProps }: PopoverModalProps) {
  return (
    <Toggletip theme="popover" {...otherProps}>
      {children}
    </Toggletip>
  );
}
