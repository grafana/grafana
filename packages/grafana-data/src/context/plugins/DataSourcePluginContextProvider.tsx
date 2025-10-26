import { PropsWithChildren, ReactElement, useMemo } from 'react';

import { DataSourceInstanceSettings } from '../../types/datasource';

import { PluginContext, DataSourcePluginContextType } from './PluginContext';

export type DataSourcePluginContextProviderProps = {
  instanceSettings: DataSourceInstanceSettings;
};

export function DataSourcePluginContextProvider(
  props: PropsWithChildren<DataSourcePluginContextProviderProps>
): ReactElement {
  const { children, instanceSettings } = props;
  const value: DataSourcePluginContextType = useMemo(() => {
    return { instanceSettings, meta: instanceSettings.meta };
  }, [instanceSettings]);

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}
