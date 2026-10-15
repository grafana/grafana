import { type JsonValue } from '@openfeature/react-sdk';
import { type Location } from 'history';
import { useEffect, useState } from 'react';
import { matchPath } from 'react-router-dom-v5-compat';

import { useFlagGrafanaMtFallback } from '@grafana/runtime/internal';

export const useMTFallback = (location: Location) => {
  const flagValue = useFlagGrafanaMtFallback();
  const urlList = getAllowedList(flagValue);
  const isUrlAllowed: boolean = urlList?.length
    ? urlList.some((pattern) => matchPath(pattern, location.pathname) !== null)
    : true;
  const [isWaiting, setIsWaiting] = useState(!isUrlAllowed);

  useEffect(() => {
    if (isUrlAllowed) {
      setIsWaiting(false);
      return;
    }

    setIsWaiting(true);
    const timeout = setTimeout(() => setIsWaiting(false), 60_000);
    return () => clearTimeout(timeout);
  }, [isUrlAllowed, location.pathname]);

  return isWaiting;
};

const getAllowedList = (value: JsonValue): string[] | undefined => {
  if (typeof value !== 'object' || !value) {
    return;
  }
  const allowList = 'allowList' in value ? value.allowList : undefined;
  if (Array.isArray(allowList)) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return allowList as string[];
  }
  return;
};
