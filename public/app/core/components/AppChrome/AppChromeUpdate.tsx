import React, { useEffect } from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';

export interface AppChromeUpdateProps {
  actions?: React.ReactNode;
}
/**
 * This needs to be moved to @grafana/ui or runtime.
 * This is the way core pages and plugins update the breadcrumbs and page toolbar actions
 */
export const AppChromeUpdate = React.memo<AppChromeUpdateProps>(({ actions }: AppChromeUpdateProps) => {
  const { chrome } = useGrafana();

  useEffect(() => {
    chrome.update({ actions });
  });
  return null;
});

AppChromeUpdate.displayName = 'TopNavUpdate';
