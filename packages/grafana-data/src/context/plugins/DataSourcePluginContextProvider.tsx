import React, { PropsWithChildren, ReactElement, useMemo } from 'react';

import { DataSourceInstanceSettings } from '../../types';

import { Context, DataSourcePluginContextType } from './PluginContext';

export type DataSourcePluginContextProviderProps = {
  instanceSettings: DataSourceInstanceSettings;
};

export function DataSourcePluginContextProvider(
  props: PropsWithChildren<DataSourcePluginContextProviderProps>
): ReactElement {
  const { children, instanceSettings } = props;
  const value: DataSourcePluginContextType = useMemo(() => {
    return { instanceSettings };
  }, [instanceSettings]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
