import React from 'react';
import { useLocation } from 'react-router-dom';

import { config } from '@grafana/runtime';
import { Grid } from '@grafana/ui/src/unstable';

import { CatalogPlugin, PluginListDisplayMode } from '../types';

import { PluginListItem } from './PluginListItem';

interface Props {
  plugins: CatalogPlugin[];
  displayMode: PluginListDisplayMode;
}

export const PluginList = ({ plugins, displayMode }: Props) => {
  const isList = displayMode === PluginListDisplayMode.List;
  const { pathname } = useLocation();
  const pathName = config.appSubUrl + (pathname.endsWith('/') ? pathname.slice(0, -1) : pathname);

  return (
    <Grid gap={3} columns={isList ? 1 : undefined} minColumnWidth={isList ? undefined : 34} data-testid="plugin-list">
      {plugins.map((plugin) => (
        <PluginListItem key={plugin.id} plugin={plugin} pathName={pathName} displayMode={displayMode} />
      ))}
    </Grid>
  );
};
