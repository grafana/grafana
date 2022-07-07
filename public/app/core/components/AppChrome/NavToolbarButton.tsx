import React, { forwardRef } from 'react';

import { config } from '@grafana/runtime';
import { ToolbarButton, ToolbarButtonProps } from '@grafana/ui/src/components/ToolbarButton';

export const NavToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>((props, ref) => {
  if (config.featureToggles.topnav) {
    const variant = props.variant ?? 'toolbar';
    return <ToolbarButton {...props} ref={ref} variant={variant} />;
  } else {
    return <ToolbarButton {...props} ref={ref} />;
  }
});

NavToolbarButton.displayName = 'NavToolbarButton';
