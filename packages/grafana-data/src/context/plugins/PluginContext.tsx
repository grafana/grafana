import React, { ReactElement, createContext, PropsWithChildren, useContext } from 'react';

import { GrafanaConfig } from '../../types/config';
import { PluginMeta } from '../../types/plugin';

export interface PluginContextType {
  meta: PluginMeta;
  config: GrafanaConfig;
}

const Context = createContext<PluginContextType | undefined>(undefined);

export type PluginProviderProps = {
  meta: PluginMeta;
  config: GrafanaConfig;
};

export function PluginProvider(props: PropsWithChildren<PluginProviderProps>): ReactElement {
  const { children, meta, config } = props;
  return <Context.Provider value={{ meta, config }}>{children}</Context.Provider>;
}

export function usePluginContext(): PluginContextType {
  const context = useContext(Context);
  if (!context) {
    throw new Error('add a b etter error message');
  }
  return context;
}
