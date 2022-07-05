import React, { useEffect } from 'react';

import { appChromeService } from './AppChromeService';
import { ToolbarUpdateProps } from './types';

/**
 * This needs to be moved to @grafana/ui or runtime.
 * This is the way core pages and plugins update the breadcrumbs and page toolbar actions
 */
export const TopNavUpdate = React.memo<ToolbarUpdateProps>(({ pageNav, actions }: ToolbarUpdateProps) => {
  useEffect(() => {
    appChromeService.update({ pageNav, actions });
  });
  return null;
});

TopNavUpdate.displayName = 'TopNavUpdate';
