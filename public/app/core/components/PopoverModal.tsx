import React from 'react';

import { Toggletip } from '@grafana/ui';
import { ToggletipProps } from '@grafana/ui/src/components/Toggletip';

interface PopoverModalProps extends Omit<ToggletipProps, 'theme'> {}

export function PopoverModal({ children, ...otherProps }: PopoverModalProps) {
  return (
    <Toggletip theme="popover" {...otherProps}>
      {children}
    </Toggletip>
  );
}
