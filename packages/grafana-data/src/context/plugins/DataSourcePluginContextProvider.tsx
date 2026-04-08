import { type PropsWithChildren, type ReactElement, useMemo } from 'react';

import { type DataSourceInstanceSettings } from '../../types/datasource';

import { PluginContext, type DataSourcePluginContextType } from './PluginContext';

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
