import React from 'react';
import { css } from '@emotion/css';
import { Icon, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { Tile } from '../components/Tile';
import { Grid } from '../components/Grid';

import { CatalogPlugin } from '../types';
import { PluginLogo } from './PluginLogo';
import { PluginBadges } from './PluginBadges';
interface Props {
  plugins: CatalogPlugin[];
}

enum IconName {
  app = 'apps',
  datasource = 'database',
  panel = 'credit-card',
  renderer = 'pen',
}

const LOGO_SIZE = '48px';

export const PluginList = ({ plugins }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Grid>
      {plugins.map((plugin) => {
        const { name, id, orgName, type } = plugin;

        return (
          <Tile
            key={`${id}`}
            href={`/plugins/${id}`}
            header={
              <div className={styles.headerWrap}>
                <PluginLogo
                  src={plugin.info.logos.small}
                  alt={`${plugin.name} logo`}
                  className={styles.image}
                  height={LOGO_SIZE}
                />
                <h3 className={styles.name}>{name}</h3>
                <div className={styles.icon}>{type && <Icon name={IconName[type]} />}</div>
              </div>
            }
            content={<p className={styles.orgName}>By {orgName}</p>}
            footer={<PluginBadges plugin={plugin} />}
          />
        );
      })}
    </Grid>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  name: css`
    color: ${theme.colors.text.primary};
    flex-grow: 1;
    font-size: ${theme.typography.h4.fontSize};
    margin-bottom: 0;
  `,
  headerWrap: css`
    align-items: center;
    display: grid;
    grid-template-columns: ${LOGO_SIZE} 1fr 24px;
    grid-gap: ${theme.spacing(2)};
  `,
  image: css`
    object-fit: contain;
    max-width: 100%;
  `,
  icon: css`
    align-self: flex-start;
    color: ${theme.colors.text.secondary};
  `,
  orgName: css`
    color: ${theme.colors.text.secondary};
    margin-bottom: 0;
  `,
});
