import React, { useLayoutEffect } from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';

import { AppChromeState } from './AppChromeService';

export type AppChromeUpdateProps = Pick<AppChromeState, 'actions' | 'pageNav'>;

/**
 * This needs to be moved to @grafana/ui or runtime.
 * This is the way core pages and plugins update the breadcrumbs and page toolbar actions
 */
export const AppChromeUpdate = React.memo<AppChromeUpdateProps>(({ actions, pageNav }: AppChromeUpdateProps) => {
  const { chrome } = useGrafana();

  // We use useLayoutEffect here to make sure that the chrome is updated before the page is rendered
  // This prevents flickering actions when going from one dashboard to another for example
  useLayoutEffect(() => {
    chrome.update({ actions, pageNav });
  });
  return null;
});

AppChromeUpdate.displayName = 'TopNavUpdate';
