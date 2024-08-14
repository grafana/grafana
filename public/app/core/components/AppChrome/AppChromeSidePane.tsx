import { useLayoutEffect } from 'react';
import * as React from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';

export interface AppChromeUpdateProps {
  left?: React.ReactNode;
}
/**
 * This needs to be moved to @grafana/ui or runtime.
 * This is the way core pages and plugins update the breadcrumbs and page toolbar actions
 */
export const AppChromeSidePane = React.memo<AppChromeUpdateProps>(({ left }: AppChromeUpdateProps) => {
  const { chrome } = useGrafana();

  // We use useLayoutEffect here to make sure that the chrome is updated before the page is rendered
  // This prevents flickering actions when going from one dashboard to another for example
  useLayoutEffect(() => {
    chrome.update({ sidePaneLeft: left });
  });
  return null;
});

AppChromeSidePane.displayName = 'AppChromeSidePane';
