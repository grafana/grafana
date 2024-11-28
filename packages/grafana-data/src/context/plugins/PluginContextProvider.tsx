import { PropsWithChildren, ReactElement } from 'react';

import { PluginMeta, UserStorage } from '../../types/plugin';

import { Context } from './PluginContext';

export type PluginContextProviderProps = {
  meta: PluginMeta;
  userStorage: UserStorage;
};

export function PluginContextProvider(props: PropsWithChildren<PluginContextProviderProps>): ReactElement {
  const { children, ...rest } = props;
  console.log('got props in PluginContextProvider', props);
  if (!('userStorage' in rest)) {
    throw new Error('PluginContextProvider requires userStorage');
  }
  return <Context.Provider value={rest}>{children}</Context.Provider>;
}
