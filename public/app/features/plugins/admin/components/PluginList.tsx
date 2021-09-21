import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { useLocation } from 'react-router-dom';
import { CatalogPlugin, PluginListDisplayMode } from '../types';
import { PluginListCard } from './PluginListCard';
import { PluginListRow } from './PluginListRow';

interface Props {
  plugins: CatalogPlugin[];
  display: PluginListDisplayMode;
}

export const PluginList = ({ plugins, display }: Props) => {
  const styles = useStyles2((theme) => getStyles(theme, display));
  const location = useLocation();

  return (
    <div className={styles.container} data-testid="plugin-list">
      {plugins.map((plugin) => {
        switch (display) {
          case PluginListDisplayMode.List:
            return <PluginListRow key={plugin.id} plugin={plugin} pathName={location.pathname} />;
          default:
            return <PluginListCard key={plugin.id} plugin={plugin} pathName={location.pathname} />;
        }
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, display: PluginListDisplayMode) => {
  const isList = display === PluginListDisplayMode.List;

  return {
    container: css`
      display: grid;
      grid-template-columns: ${isList ? 'repeat(auto-fill)' : 'repeat(auto-fill, minmax(288px, 1fr))'};
      grid-gap: ${theme.spacing(3)};
    `,
  };
};
