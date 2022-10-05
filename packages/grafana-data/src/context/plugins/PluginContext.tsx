import React, { ReactElement, createContext, PropsWithChildren, useContext } from 'react';

import { PluginMeta } from '../../types/plugin';

export interface PluginContextType {
  meta: PluginMeta;
}

const Context = createContext<PluginContextType | undefined>(undefined);

export type PluginContextProviderProps = {
  meta: PluginMeta;
};

export function PluginContextProvider(props: PropsWithChildren<PluginContextProviderProps>): ReactElement {
  const { children, ...rest } = props;
  return <Context.Provider value={rest}>{children}</Context.Provider>;
}

export function usePluginContext(): PluginContextType {
  const context = useContext(Context);
  if (!context) {
    throw new Error('add a b etter error message');
  }
  return context;
}
