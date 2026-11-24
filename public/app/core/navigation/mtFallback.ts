import { type JsonValue } from '@openfeature/react-sdk';
import { type Location } from 'history';
import { matchPath } from 'react-router-dom-v5-compat';

import { FlagKeys, getFeatureFlagClient, useFlagGrafanaMtFallback } from '@grafana/runtime/internal';

export const useIsUrlAllowed = (location: Pick<Location, 'pathname'>): boolean => {
  const flagValue = useFlagGrafanaMtFallback();
  const urlList = getAllowedList(flagValue) ?? [];
  return urlList.some((pattern) => matchPath(pattern, location.pathname) !== null);
};

export const useIsMtFallbackConfigured = (): boolean => isMtFallbackConfigured(useFlagGrafanaMtFallback());

// Without a value it reads the flag client, for code outside React (e.g. backend_srv); that does not re-render on flag changes.
export const isMtFallbackConfigured = (
  flagValue: JsonValue = getFeatureFlagClient().getObjectValue<JsonValue>(FlagKeys.GrafanaMtFallback, {})
): boolean => Boolean(getAllowedList(flagValue)?.length);

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
