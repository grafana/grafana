import { createContext, ReactElement, PropsWithChildren, useMemo, useContext } from 'react';

import { VizPanel } from '@grafana/scenes';

// All APIs need to be optional, because they are made available to plugins based on the configuration
export interface RestrictedGrafanaApisContextType {
  addPanel?: (vizPanel: VizPanel) => void;
}

export const RestrictedGrafanaApisContext = createContext<RestrictedGrafanaApisContextType>({});

export type Props = {
  pluginId: string;
  apis: RestrictedGrafanaApisContextType;
  apiWhitelist: Record<keyof RestrictedGrafanaApisContextType, string[]>;
};

export function RestrictedGrafanaApisContextProvider(props: PropsWithChildren<Props>): ReactElement {
  const { children, pluginId, apis, apiWhitelist } = props;

  const allowedApis = useMemo(() => {
    const allowedApis: RestrictedGrafanaApisContextType = {};
    for (const api of Object.keys(apiWhitelist)) {
      if (apiWhitelist[api as keyof RestrictedGrafanaApisContextType].includes(pluginId)) {
        allowedApis[api as keyof RestrictedGrafanaApisContextType] =
          apis[api as keyof RestrictedGrafanaApisContextType];
      }
    }

    return allowedApis;
  }, [apis, apiWhitelist, pluginId]);

  return <RestrictedGrafanaApisContext.Provider value={allowedApis}>{children}</RestrictedGrafanaApisContext.Provider>;
}

export function useRestrictedGrafanaApis(): RestrictedGrafanaApisContextType {
  const context = useContext(RestrictedGrafanaApisContext);

  if (!context) {
    // We might want to log a warning here
    return {};
  }

  return context;
}
