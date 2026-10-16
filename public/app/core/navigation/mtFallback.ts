import { type JsonValue } from '@openfeature/react-sdk';
import { type Location } from 'history';
import { matchPath } from 'react-router-dom-v5-compat';

import { useFlagGrafanaMtFallback } from '@grafana/runtime/internal';

export const useIsUrlAllowed = (location: Location) => {
  const flagValue = useFlagGrafanaMtFallback();
  const urlList = getAllowedList(flagValue);
  return urlList?.length ? urlList.some((pattern) => matchPath(pattern, location.pathname) !== null) : true;
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
