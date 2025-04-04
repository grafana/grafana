import { useLayoutEffect } from 'react';
import * as React from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';

export interface AppChromeUpdateProps {
  actions?: React.ReactNode;
  actionsLeft?: React.ReactNode;
  actionsRight?: React.ReactNode;
}
/**
 * This is the way core pages add actions to the second chrome toolbar
 */
export const AppChromeUpdate = React.memo<AppChromeUpdateProps>(
  ({ actions, actionsLeft, actionsRight }: AppChromeUpdateProps) => {
    const { chrome } = useGrafana();

    // We use useLayoutEffect here to make sure that the chrome is updated before the page is rendered
    // This prevents flickering actions when going from one dashboard to another for example
    useLayoutEffect(() => {
      chrome.update({ actions, actionsLeft, actionsRight });

      return () => {
        chrome.update({ actions: null, actionsLeft: null, actionsRight });
      };
    });

    return null;
  }
);

AppChromeUpdate.displayName = 'TopNavUpdate';
