import React from 'react';
import { css } from '@emotion/css';
import { Icon, useStyles2, CardContainer, VerticalGroup } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { CatalogPlugin } from '../types';
import { PluginLogo } from './PluginLogo';
import { PluginBadges } from './PluginBadges';

const LOGO_SIZE = '48px';

enum IconName {
  app = 'apps',
  datasource = 'database',
  panel = 'credit-card',
  renderer = 'pen',
}

type PluginListCardProps = {
  plugin: CatalogPlugin;
  pathName: string;
};

export function PluginListCard({ plugin, pathName }: PluginListCardProps) {
  const { name, id, orgName, type } = plugin;
  const styles = useStyles2(getStyles);

  return (
    <CardContainer href={`${pathName}/${id}`} className={styles.cardContainer}>
      <VerticalGroup spacing="md">
        <div className={styles.headerWrap}>
          <PluginLogo
            src={plugin.info.logos.small}
            alt={`${plugin.name} logo`}
            className={styles.image}
            height={LOGO_SIZE}
          />
          <h3 className={styles.name}>{name}</h3>
          {type && (
            <div className={styles.icon}>
              <Icon name={IconName[type]} aria-label={`${type} plugin icon`} />
            </div>
          )}
        </div>
        <p className={styles.orgName}>By {orgName}</p>
        <PluginBadges plugin={plugin} />
      </VerticalGroup>
    </CardContainer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  cardContainer: css`
    margin-bottom: 0;
    padding: ${theme.spacing()};
  `,
  headerWrap: css`
    align-items: center;
    display: grid;
    grid-template-columns: ${LOGO_SIZE} 1fr ${theme.spacing(3)};
    grid-gap: ${theme.spacing(2)};
    width: 100%;
  `,
  name: css`
    color: ${theme.colors.text.primary};
    flex-grow: 1;
    font-size: ${theme.typography.h4.fontSize};
    margin-bottom: 0;
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
