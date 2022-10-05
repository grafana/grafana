import React, { PropsWithChildren, ReactElement } from 'react';

import { DataSourceInstanceSettings } from '../../types';
import { PluginMeta } from '../../types/plugin';

import { Context } from './PluginContext';

export type DataSourcePluginContextProviderProps = {
  meta: PluginMeta;
  settings: DataSourceInstanceSettings;
};

export function DataSourcePluginContextProvider(
  props: PropsWithChildren<DataSourcePluginContextProviderProps>
): ReactElement {
  const { children, ...rest } = props;
  return <Context.Provider value={rest}>{children}</Context.Provider>;
}
