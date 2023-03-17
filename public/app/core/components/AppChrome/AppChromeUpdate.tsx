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
  const state = chrome.useState();

  useEffect(() => {
    chrome.update({ actions });
    // update when chrome service state changes, but ignore actions change
    // components don't memoize actions resulting in new ref every render, but they are static in practice
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chrome, state]);
  return null;
});

AppChromeUpdate.displayName = 'TopNavUpdate';
