import React from 'react';
import { useStyles2, Icon } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { Card } from '../components/Card';
import { Grid } from '../components/Grid';

import { Plugin, LocalPlugin } from '../types';
import { GrafanaTheme2 } from '@grafana/data';
import { isLocalPlugin } from '../guards';
import { PluginLogo } from './PluginLogo';
interface Props {
  plugins: Array<Plugin | LocalPlugin>;
}

export const PluginList = ({ plugins }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Grid>
      {plugins.map((plugin) => {
        const id = getPluginId(plugin);
        const description = getPluginDescription(plugin);
        const { name } = plugin;

        return (
          <Card
            key={`${id}`}
            href={`/plugins/${id}`}
            header={
              <div className={styles.headerWrap}>
                <PluginLogo plugin={plugin} className={styles.image} />
                <h3 className={styles.name}>{name}</h3>
              </div>
            }
            content={<p className={styles.description}>{description}</p>}
            footer={<PluginListBadge />}
          />
        );
      })}
    </Grid>
  );
};

enum PluginStatus {
  Available = 'Available',
  Installed = 'Installed',
}

function PluginListBadge({ status = PluginStatus.Available }) {
  const styles = useStyles2(getBadgeStyles);
  return (
    <div
      className={cx(styles.wrap, {
        [styles.available]: status === PluginStatus.Available,
      })}
    >
      {status === PluginStatus.Available && <Icon name="check" className={styles.icon} size="md" />}
      <span>{status}</span>
    </div>
  );
}

function getPluginId(plugin: Plugin | LocalPlugin): string {
  if (isLocalPlugin(plugin)) {
    return plugin.id;
  }
  return plugin.slug;
}

function getPluginDescription(plugin: Plugin | LocalPlugin): string | undefined {
  if (isLocalPlugin(plugin)) {
    return plugin.info?.description;
  }
  return plugin.description;
}

const getStyles = (theme: GrafanaTheme2) => ({
  name: css`
    color: ${theme.colors.text.primary};
    flex-grow: 1;
    font-size: ${theme.typography.h4.fontSize};
    margin-bottom: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  headerWrap: css`
    align-items: center;
    display: grid;
    grid-template-columns: min(64px, 15%) 1fr;
    grid-gap: 1rem;
  `,
  image: css`
    aspect-ratio: 1;
    max-width: 100%;
  `,
  description: css`
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    color: ${theme.colors.text.secondary};
    display: -webkit-box;
    font-size: ${theme.typography.body.fontSize};
    margin-bottom: 0;
    overflow: hidden;
  `,
});

const getBadgeStyles = (theme: GrafanaTheme2) => ({
  wrap: css`
    background-color: ${theme.colors.background.primary};
    border-radius: ${theme.shape.borderRadius()};
    display: inline-block;
    font-size: ${theme.typography.h6.fontSize};
    padding: ${theme.spacing()};
  `,
  icon: css`
    margin-right: ${theme.spacing(0.5)};
  `,
  available: css`
    color: ${theme.colors.success.text};
  `,
});
