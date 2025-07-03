import { Context, useContext } from 'react';

import { KeyValue } from '../../types/data';

import { PluginContext, PluginContextType } from './PluginContext';

export function usePluginContext<T extends KeyValue = KeyValue>(): PluginContextType<T> | null {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const context = useContext(PluginContext as Context<PluginContextType<T> | undefined>);

  // The extensions hooks (e.g. `usePluginLinks()`) are using this hook to check
  // if they are inside a plugin or not (core Grafana), so we should be able to return an empty state as well (`null`).
  if (!context) {
    return null;
  }

  return context;
}
