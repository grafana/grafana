import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { CatalogPlugin, PluginIconName, PluginListDisplayMode } from '../types';
import { PluginListItemBadges } from './PluginListItemBadges';
import { PluginLogo } from './PluginLogo';
import { Icon, useStyles2 } from '@grafana/ui';

export const LOGO_SIZE = '48px';

type Props = {
  plugin: CatalogPlugin;
  pathName: string;
  displayMode?: PluginListDisplayMode;
};

export function PluginListItem({ plugin, pathName, displayMode = PluginListDisplayMode.Grid }: Props) {
  const styles = useStyles2(getStyles);
  const isList = displayMode === PluginListDisplayMode.List;

  return (
    <a href={`${pathName}/${plugin.id}`} className={cx(styles.container, { [styles.list]: isList })}>
      <PluginLogo src={plugin.info.logos.small} className={styles.pluginLogo} height={LOGO_SIZE} alt="" />
      <h2 className={cx(styles.name, 'plugin-name')}>{plugin.name}</h2>
      <div className={cx(styles.content, 'plugin-content')}>
        <p>By {plugin.orgName}</p>
        <PluginListItemBadges plugin={plugin} />
      </div>
      <div className={styles.pluginType}>
        {plugin.type && <Icon name={PluginIconName[plugin.type]} title={`${plugin.type} plugin`} />}
      </div>
    </a>
  );
}

// Styles shared between the different type of list items
export const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: grid;
      grid-template-columns: ${LOGO_SIZE} 1fr ${theme.spacing(3)};
      grid-template-rows: auto;
      gap: ${theme.spacing(2)};
      grid-auto-flow: row;
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
      padding: ${theme.spacing(3)};
      transition: ${theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
        duration: theme.transitions.duration.short,
      })};

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
      }
    `,
    list: css`
      row-gap: 0px;

      > img {
        align-self: start;
      }

      > .plugin-content {
        min-height: 0px;
        grid-area: 2 / 2 / 4 / 3;

        > p {
          margin: ${theme.spacing(0, 0, 0.5, 0)};
        }
      }

      > .plugin-name {
        align-self: center;
        grid-area: 1 / 2 / 2 / 3;
      }
    `,
    pluginType: css`
      grid-area: 1 / 3 / 2 / 4;
      color: ${theme.colors.text.secondary};
    `,
    pluginLogo: css`
      grid-area: 1 / 1 / 3 / 2;
      max-width: 100%;
      align-self: center;
      object-fit: contain;
    `,
    content: css`
      grid-area: 3 / 1 / 4 / 3;
      color: ${theme.colors.text.secondary};
    `,
    name: css`
      grid-area: 1 / 2 / 3 / 3;
      align-self: center;
      font-size: ${theme.typography.h4.fontSize};
      color: ${theme.colors.text.primary};
      margin: 0;
    `,
  };
};
