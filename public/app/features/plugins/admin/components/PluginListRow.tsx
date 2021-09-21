import React from 'react';
import { css } from '@emotion/css';
import { Icon, useStyles2, CardContainer, HorizontalGroup, VerticalGroup, Tooltip } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { CatalogPlugin, IconName } from '../types';
import { PluginLogo } from './PluginLogo';
import { PluginListBadges } from './PluginListBadges';

const LOGO_SIZE = '48px';

type PluginListRowProps = {
  plugin: CatalogPlugin;
  pathName: string;
};

export function PluginListRow({ plugin, pathName }: PluginListRowProps) {
  const styles = useStyles2(getStyles);

  return (
    <CardContainer href={`${pathName}/${plugin.id}`} className={styles.cardContainer}>
      <VerticalGroup spacing="md">
        <div className={styles.headerWrap}>
          <PluginLogo
            src={plugin.info.logos.small}
            alt={`${plugin.name} logo`}
            className={styles.image}
            height={LOGO_SIZE}
          />
          <div>
            <h3 className={styles.name}>{plugin.name}</h3>
            <p className={styles.orgName}>By {plugin.orgName}</p>
            <HorizontalGroup height="auto">
              <PluginListBadges plugin={plugin} />
              {plugin.hasUpdate && !plugin.isCore ? (
                <Tooltip content={plugin.version}>
                  <p className={styles.hasUpdate}>Update available!</p>
                </Tooltip>
              ) : null}
            </HorizontalGroup>
          </div>
          {plugin.type && (
            <div className={styles.icon}>
              <Icon name={IconName[plugin.type]} aria-label={`${plugin.type} plugin icon`} />
            </div>
          )}
        </div>
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
    margin: ${theme.spacing(0, 0, 0.5, 0)};
  `,
  hasUpdate: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    margin-bottom: 0;
  `,
});
