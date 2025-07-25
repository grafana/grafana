import { createContext, ReactElement, PropsWithChildren, useMemo, useContext } from 'react';

import { VizPanel } from '@grafana/scenes';

// Add new "restricted" APIs here
export interface RestrictedGrafanaApisContextTypeInternal {
  addPanel?: (vizPanel: VizPanel) => void;
}

// We are exposing this through a "type validation", to make sure that all APIs are optional (which helps plugins catering for scenarios when they are not available). 
type RequireAllPropertiesOptional<T> = keyof T extends never
  ? T
  : { [K in keyof T]-?: undefined extends T[K] ? never : K }[keyof T] extends never
    ? T
    : 'Error: all properties of `RestrictedGrafanaApisContextTypeInternal` must be marked as optional, as their availability is controlled via a configuration parameter. Please have a look at `RestrictedGrafanaApisContextTypeInternal`.';
export type RestrictedGrafanaApisContextType = RequireAllPropertiesOptional<RestrictedGrafanaApisContextTypeInternal>;

// A type for whitelisting / blacklisting plugins for a given API
export type RestrictedGrafanaApisWhitelist = Partial<
  Record<keyof RestrictedGrafanaApisContextType, Array<string | RegExp>>
>;

export const RestrictedGrafanaApisContext = createContext<RestrictedGrafanaApisContextType>({});

export type Props = {
  pluginId: string;
  apis: RestrictedGrafanaApisContextType;
  // Use it to share APIs with plugins (TAKES PRECEDENCE over `apiBlacklist`)
  apiWhitelist?: RestrictedGrafanaApisWhitelist;
  // Use it to disable sharing APIs with plugins.
  apiBlacklist?: RestrictedGrafanaApisWhitelist;
};

export function RestrictedGrafanaApisContextProvider(props: PropsWithChildren<Props>): ReactElement {
  const { children, pluginId, apis, apiWhitelist, apiBlacklist } = props;

  const allowedApis = useMemo(() => {
    const allowedApis: RestrictedGrafanaApisContextType = {};

    for (const api of Object.keys(apis) as Array<keyof RestrictedGrafanaApisContextType>) {
      if (
        apiWhitelist &&
        apiWhitelist[api] &&
        (apiWhitelist[api].includes(pluginId) ||
          apiWhitelist[api].some((keyword) => keyword instanceof RegExp && keyword.test(pluginId)))
      ) {
        allowedApis[api] = apis[api];
        continue;
      }

      // IF no whitelist is defined (only blacklist), then we only omit the blacklisted APIs
      if (
        (!apiWhitelist || Object.keys(apiWhitelist).length === 0) &&
        apiBlacklist &&
        apiBlacklist[api] &&
        !(
          apiBlacklist[api].includes(pluginId) ||
          apiBlacklist[api].some((keyword) => keyword instanceof RegExp && keyword.test(pluginId))
        )
      ) {
        allowedApis[api] = apis[api];
      }
    }

    return allowedApis;
  }, [apis, apiWhitelist, apiBlacklist, pluginId]);

  return <RestrictedGrafanaApisContext.Provider value={allowedApis}>{children}</RestrictedGrafanaApisContext.Provider>;
}

export function useRestrictedGrafanaApis(): RestrictedGrafanaApisContextType {
  const context = useContext(RestrictedGrafanaApisContext);

  if (!context) {
    throw new Error(
      'useRestrictedGrafanaApis() can only be used inside a plugin context (The `RestrictedGrafanaApisContext` is not available).'
    );
  }

  return context;
}
