import React, { PropsWithChildren, ReactElement } from 'react';

import { PluginMeta } from '../../types/plugin';

import { Context } from './PluginContext';

export type PluginContextProviderProps = {
  meta: PluginMeta;
};

export function PluginContextProvider(props: PropsWithChildren<PluginContextProviderProps>): ReactElement {
  const { children, ...rest } = props;
  return <Context.Provider value={rest}>{children}</Context.Provider>;
}
