import { useLocation } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { EmptyState, Grid } from '@grafana/ui';

import { CatalogPlugin } from '../types';

import { PluginListItem } from './PluginListItem';

interface Props {
  plugins: CatalogPlugin[];
  isLoading?: boolean;
}

export const PluginList = ({ plugins, isLoading }: Props) => {
  const { pathname } = useLocation();

  const pathName = config.appSubUrl + (pathname.endsWith('/') ? pathname.slice(0, -1) : pathname);

  if (!isLoading && plugins.length === 0) {
    return <EmptyState variant="not-found" message={t('plugins.empty-state.message', 'No plugins found')} />;
  }

  return (
    <Grid gap={3} {...{ minColumnWidth: 34 }} data-testid="plugin-list">
      {isLoading
        ? new Array(50).fill(null).map((_, index) => <PluginListItem.Skeleton key={index} />)
        : plugins.map((plugin) => <PluginListItem key={plugin.id} plugin={plugin} pathName={pathName} />)}
    </Grid>
  );
};
