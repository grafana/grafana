import React, { useEffect } from 'react';

import { NavModelItem } from '@grafana/data';

import { appChromeService } from './AppChromeService';

export interface AppChromeUpdateProps {
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
}
/**
 * This needs to be moved to @grafana/ui or runtime.
 * This is the way core pages and plugins update the breadcrumbs and page toolbar actions
 */
export const AppChromeUpdate = React.memo<AppChromeUpdateProps>(({ pageNav, actions }: AppChromeUpdateProps) => {
  useEffect(() => {
    appChromeService.update({ pageNav, actions });
  });
  return null;
});

AppChromeUpdate.displayName = 'TopNavUpdate';
