import { type PropsWithChildren, type ReactElement } from 'react';

import { type PluginMeta } from '../../types/plugin';

import { PluginContext } from './PluginContext';

export type PluginContextProviderProps = {
  meta: PluginMeta;
};

export function PluginContextProvider(props: PropsWithChildren<PluginContextProviderProps>): ReactElement {
  const { children, ...rest } = props;
  return <PluginContext.Provider value={rest}>{children}</PluginContext.Provider>;
}
