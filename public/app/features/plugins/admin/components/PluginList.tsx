import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { Card } from '../components/Card';
import { Grid } from '../components/Grid';

import { CatalogPlugin } from '../types';
import { GrafanaTheme2 } from '@grafana/data';
import { PluginLogo } from './PluginLogo';

interface Props {
  plugins: CatalogPlugin[];
}

export const PluginList = ({ plugins }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Grid>
      {plugins.map((plugin) => {
        const { name, id, orgName } = plugin;

        return (
          <Card
            key={`${id}`}
            href={`/plugins/${id}`}
            image={
              <PluginLogo
                src={plugin.info.logos.small}
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
