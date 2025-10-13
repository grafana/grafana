import * as H from 'history';
import { useEffect } from 'react';

import { locationService } from '@grafana/runtime';

interface PromptProps {
  when?: boolean;
  message: string | ((location: H.Location) => string | boolean);
}

export const Prompt = ({ message, when = true }: PromptProps) => {
  const history = locationService.getHistory();

  useEffect(() => {
    if (!when) {
      return undefined;
    }
    //@ts-expect-error TODO Update the history package to fix types
    const unblock = history.block(message);

    return () => {
      unblock();
    };
  }, [when, message, history]);

  return null;
};
