import { useLayoutEffect, useEffect } from 'react';
import * as React from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';

export interface AppChromeUpdateProps {
  actions?: React.ReactNode;
  breadcrumbActions?: React.ReactNode;
}
/**
 * This is the way core pages add actions to the second chrome toolbar
 */
export const AppChromeUpdate = React.memo<AppChromeUpdateProps>(
  ({ actions, breadcrumbActions }: AppChromeUpdateProps) => {
    const { chrome } = useGrafana();

    // Unmount cleanup
    useLayoutEffect(() => {
      return () => {
        console.log('Clean up of app chrome actions');
        chrome.update({ actions: undefined, breadcrumbActions: undefined });
      };
    }, [chrome]);

    // We use useLayoutEffect here to make sure that the chrome is updated before the page is rendered
    // This prevents flickering actions when going from one dashboard to another for example
    useLayoutEffect(() => {
      console.log('Update app chrome actions');
      chrome.update({ actions, breadcrumbActions });
    });

    return null;
  }
);

AppChromeUpdate.displayName = 'TopNavUpdate';
