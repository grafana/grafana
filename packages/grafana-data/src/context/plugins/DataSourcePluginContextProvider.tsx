import { PropsWithChildren, ReactElement, useMemo } from 'react';

import { DataSourceInstanceSettings } from '../../types/datasource';

import { Context, DataSourcePluginContextType } from './PluginContext';

export type DataSourcePluginContextProviderProps = {
  instanceSettings: DataSourceInstanceSettings;
};

export function DataSourcePluginContextProvider(
  props: PropsWithChildren<DataSourcePluginContextProviderProps>
): ReactElement {
  const { children, instanceSettings } = props;
  const value: DataSourcePluginContextType = useMemo(() => {
    return {
      instanceSettings,
      meta: instanceSettings.meta,
      // TODO: Implement user storage
      userStorage: {
        getItem: async (k: string) => '',
        setItem: async (k: string, v: string) => {},
      },
    };
  }, [instanceSettings]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
