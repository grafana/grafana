import { PropsWithChildren, ReactElement } from 'react';

import { PluginMeta } from '../../types/plugin';

import { PluginContext } from './PluginContext';
import { usePluginContext } from './usePluginContext';

export type PluginContextProviderProps = {
  meta: PluginMeta;
};

export function PluginContextProvider(props: PropsWithChildren<PluginContextProviderProps>): ReactElement {
  const { children, ...rest } = props;
  const parentPluginContext = usePluginContext();

  return <PluginContext.Provider value={{ ...rest, parent: parentPluginContext }}>{children}</PluginContext.Provider>;
}
