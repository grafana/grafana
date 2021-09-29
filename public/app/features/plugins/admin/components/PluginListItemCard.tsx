import React from 'react';
import { Icon, useStyles2, HorizontalGroup, Tooltip, CardContainer, VerticalGroup } from '@grafana/ui';
import { CatalogPlugin, PluginIconName, PluginListDisplayMode, PluginTabIds } from '../types';
import { PluginLogo } from './PluginLogo';
import { PluginListBadges } from './PluginListBadges';
import { getStyles, LOGO_SIZE } from './PluginListItem';

type Props = {
  plugin: CatalogPlugin;
  pathName: string;
};

export function PluginListItemCard({ plugin, pathName }: Props) {
  const styles = useStyles2((theme) => getStyles(theme, PluginListDisplayMode.Grid));

  return (
    <CardContainer href={`${pathName}/${plugin.id}?page=${PluginTabIds.OVERVIEW}`} className={styles.cardContainer}>
      <VerticalGroup spacing="md">
        <div className={styles.headerWrap}>
          <PluginLogo
            src={plugin.info.logos.small}
            alt={`${plugin.name} logo`}
            className={styles.image}
            height={LOGO_SIZE}
          />
          <h2 className={styles.name}>{plugin.name}</h2>
          {plugin.type && (
            <div className={styles.icon} data-testid={`${plugin.type} plugin icon`}>
              <Icon name={PluginIconName[plugin.type]} />
            </div>
          )}
        </div>
        <p className={styles.orgName}>By {plugin.orgName}</p>
        <HorizontalGroup align="center">
          <PluginListBadges plugin={plugin} />
          {plugin.hasUpdate && !plugin.isCore ? (
            <Tooltip content={plugin.version}>
              <p className={styles.hasUpdate}>Update available!</p>
            </Tooltip>
          ) : null}
        </HorizontalGroup>
      </VerticalGroup>
    </CardContainer>
  );
}
