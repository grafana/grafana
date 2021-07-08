import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { Card } from '../components/Card';
import { Grid } from '../components/Grid';

import { Plugin } from '../types';
import { GrafanaTheme2 } from '@grafana/data';
import { isLocalPlugin } from '../guards';
import { PluginLogo } from './PluginLogo';

interface Props {
  plugins: Plugin[];
}

export const PluginList = ({ plugins }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Grid>
      {plugins.map((plugin) => {
        const { name, orgName, typeCode } = plugin;
        return (
          <Card
            key={`${orgName}-${name}-${typeCode}`}
            href={`/plugins/${getPluginId(plugin)}`}
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
                <div className={styles.orgName}>{orgName}</div>
              </>
            }
          />
        );
      })}
    </Grid>
  );
};

function getPluginId(plugin: Plugin): string {
  if (isLocalPlugin(plugin)) {
    return plugin.id;
  }
  return plugin.slug;
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
