import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
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
        const { name } = plugin;

        return (
          <Card
            key={`${id}`}
            href={`/plugins/${id}`}
            image={
              <PluginLogo
                plugin={plugin}
                className={css`
                  max-height: 64px;
                `}
              />
            }
            text={
              <>
                <div className={styles.name}>{name}</div>
                <div className={styles.orgName}>{getOrgName(plugin)}</div>
              </>
            }
          />
        );
      })}
    </Grid>
  );
};

function getPluginId(plugin: Plugin | LocalPlugin): string {
  if (isLocalPlugin(plugin)) {
    return plugin.id;
  }
  return plugin.slug;
}

function getOrgName(plugin: Plugin | LocalPlugin): string | undefined {
  if (isLocalPlugin(plugin)) {
    return plugin.info?.author?.name;
  }
  return plugin.orgName;
}

const getStyles = (theme: GrafanaTheme2) => ({
  name: css`
    font-size: ${theme.typography.h4.fontSize};
    color: ${theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
  `,
  orgName: css`
    font-size: ${theme.typography.body.fontSize};
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
  `,
});
