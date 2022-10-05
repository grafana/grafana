import React, { PropsWithChildren, ReactElement } from 'react';

import { DataQuery, DataSourceApi } from '../../types';
import { PluginMeta } from '../../types/plugin';

import { Context } from './PluginContext';

export type DataSourcePluginContextProviderProps<TQuery extends DataQuery = DataQuery> = {
  meta: PluginMeta;
  dataSource: DataSourceApi<TQuery>;
};

export function DataSourcePluginContextProvider<TQuery extends DataQuery = DataQuery>(
  props: PropsWithChildren<DataSourcePluginContextProviderProps<TQuery>>
): ReactElement {
  const { children, ...rest } = props;
  return <Context.Provider value={rest}>{children}</Context.Provider>;
}
