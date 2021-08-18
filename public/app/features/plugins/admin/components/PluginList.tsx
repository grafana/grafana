import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { CatalogPlugin } from '../types';
import { PluginListCard } from './PluginListCard';
import { useLocation } from 'react-router-dom';

interface Props {
  plugins: CatalogPlugin[];
}

export const PluginList = ({ plugins }: Props) => {
  const styles = useStyles2(getStyles);
  const location = useLocation();

  return (
    <div className={styles} data-testid="plugin-list">
      {plugins.map((plugin) => (
        <PluginListCard key={plugin.id} plugin={plugin} pathName={location.pathname} />
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
  grid-gap: ${theme.spacing(3)};
`;
