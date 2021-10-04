import React from 'react';
import { Icon, useStyles2, CardContainer, VerticalGroup } from '@grafana/ui';
import { CatalogPlugin, PluginIconName, PluginListDisplayMode, PluginTabIds } from '../types';
import { PluginLogo } from './PluginLogo';
import { PluginListItemBadges } from './PluginListItemBadges';
import { getStyles, LOGO_SIZE } from './PluginListItem';

type Props = {
  plugin: CatalogPlugin;
  pathName: string;
};

export function PluginListItemRow({ plugin, pathName }: Props) {
  const styles = useStyles2((theme) => getStyles(theme, PluginListDisplayMode.List));

  return (
    <CardContainer href={`${pathName}/${plugin.id}?page=${PluginTabIds.OVERVIEW}`} className={styles.cardContainer}>
      <VerticalGroup spacing="md">
        <div className={styles.headerWrap}>
          {/* Logo */}
          <PluginLogo
            src={plugin.info.logos.small}
            alt={`${plugin.name} logo`}
            className={styles.image}
            height={LOGO_SIZE}
          />

          <div>
            {/* Name */}
            <h3 className={styles.name}>{plugin.name}</h3>

            {/* Org */}
            <p className={styles.orgName}>By {plugin.orgName}</p>

            {/* Badges */}
            <PluginListItemBadges plugin={plugin} />
          </div>

          {/* Type Icon */}
          {plugin.type && (
            <div className={styles.icon}>
              <Icon name={PluginIconName[plugin.type]} aria-label={`${plugin.type} plugin icon`} />
            </div>
          )}
        </div>
      </VerticalGroup>
    </CardContainer>
  );
}
