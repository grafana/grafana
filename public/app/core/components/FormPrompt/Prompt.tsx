import { useEffect, useCallback } from 'react';

import { locationService } from '@grafana/runtime';

interface PromptProps {
  when: boolean;
  message: string | ((location: { pathname: string }) => string);
}

export const Prompt = ({ when, message }: PromptProps) => {
  const currentLocation = locationService.getLocation();
  const history = locationService.getHistory();

  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!when) {
        return undefined;
      }
      const msg = typeof message === 'function' ? message({ pathname: currentLocation.pathname }) : message;
      event.preventDefault();
      event.returnValue = msg;
      return msg;
    },
    [when, message, currentLocation]
  );

  useEffect(() => {
    if (!when) {
      return undefined;
    }
    // Handle browser refresh/close
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Handle in-app navigation
    const unblock = history.block((nextLocation) => {
      if (nextLocation.pathname !== currentLocation.pathname) {
        return typeof message === 'function' ? message(nextLocation) : message;
      } else {
        return undefined;
      }
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unblock();
    };
  }, [when, message, history, currentLocation, handleBeforeUnload]);

  return null;
};
