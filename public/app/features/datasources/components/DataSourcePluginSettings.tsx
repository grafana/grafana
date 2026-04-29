import { createElement, memo } from 'react';

import { type DataSourcePluginMeta, type DataSourceSettings } from '@grafana/data';
import { writableProxy } from 'app/features/plugins/extensions/utils';

import { type GenericDataSourcePlugin } from '../types';

export interface Props {
  plugin: GenericDataSourcePlugin;
  dataSource: DataSourceSettings;
  dataSourceMeta: DataSourcePluginMeta;
  onModelChange: (dataSource: DataSourceSettings) => void;
}

export const DataSourcePluginSettings = memo(({ plugin, dataSource, onModelChange }: Props) => {
  if (!plugin) {
    return null;
  }

  return (
    <div>
      {plugin.components.ConfigEditor &&
        createElement(plugin.components.ConfigEditor, {
          options: writableProxy(dataSource, {
            source: 'datasource',
            pluginId: plugin.meta?.id,
            pluginVersion: plugin.meta?.info?.version,
          }),
          onOptionsChange: onModelChange,
        })}
    </div>
  );
});
DataSourcePluginSettings.displayName = 'DataSourcePluginSettings';
