import * as H from 'history';
import { useEffect } from 'react';

import { locationService } from '@grafana/runtime';

interface PromptProps {
  when: boolean;
  message: string | ((location: H.Location) => string | boolean);
}

export const Prompt = ({ when, message }: PromptProps) => {
  const currentLocation = locationService.getLocation();
  const history = locationService.getHistory();

  useEffect(() => {
    if (!when) {
      return undefined;
    }
    //@ts-expect-error
    const unblock = history.block((nextLocation) => {
      if (nextLocation.pathname !== currentLocation.pathname) {
        return typeof message === 'function' ? message(nextLocation) : message;
      } else {
        return false;
      }
    });

    return () => {
      unblock();
    };
  }, [when, message, history, currentLocation]);

  return null;
};
