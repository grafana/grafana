import { css, cx } from '@emotion/css';
import React from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Badge, Icon, Stack, useStyles2 } from '@grafana/ui';
import { SkeletonComponent, attachSkeleton } from '@grafana/ui/src/unstable';

import { CatalogPlugin, PluginIconName, PluginListDisplayMode } from '../types';

import { PluginListItemBadges } from './PluginListItemBadges';
import { PluginLogo } from './PluginLogo';

export const LOGO_SIZE = '48px';

type Props = {
  plugin: CatalogPlugin;
  pathName: string;
  displayMode?: PluginListDisplayMode;
};

function PluginListItemComponent({ plugin, pathName, displayMode = PluginListDisplayMode.Grid }: Props) {
  const styles = useStyles2(getStyles);
  const isList = displayMode === PluginListDisplayMode.List;

  const reportUserClickInteraction = () => {
    if (locationService.getSearchObject()?.q) {
      reportInteraction('plugins_search_user_click', {});
    }
  };
  return (
    <a
      href={`${pathName}/${plugin.id}`}
      className={cx(styles.container, { [styles.list]: isList })}
      onClick={reportUserClickInteraction}
    >
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

const PluginListItemSkeleton: SkeletonComponent<Pick<Props, 'displayMode'>> = ({
  displayMode = PluginListDisplayMode.Grid,
  rootProps,
}) => {
  const styles = useStyles2(getStyles);
  const isList = displayMode === PluginListDisplayMode.List;

  return (
    <div className={cx(styles.container, { [styles.list]: isList })} {...rootProps}>
      <Skeleton
        containerClassName={cx(
          styles.pluginLogo,
          css({
            lineHeight: 1,
          })
        )}
        width={LOGO_SIZE}
        height={LOGO_SIZE}
      />
      <h2 className={styles.name}>
        <Skeleton width={100} />
      </h2>
      <div className={styles.content}>
        <p>
          <Skeleton width={120} />
        </p>
        <Stack direction="row">
          <Badge.Skeleton />
          <Badge.Skeleton />
        </Stack>
      </div>
      <div className={styles.pluginType}>
        <Skeleton width={16} height={16} />
      </div>
    </div>
  );
};

export const PluginListItem = attachSkeleton(PluginListItemComponent, PluginListItemSkeleton);

// Styles shared between the different type of list items
export const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'grid',
      gridTemplateColumns: `${LOGO_SIZE} 1fr ${theme.spacing(3)}`,
      gridTemplateRows: 'auto',
      gap: theme.spacing(2),
      gridAutoFlow: 'row',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(3),
      transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
        duration: theme.transitions.duration.short,
      }),

      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    }),
    list: css({
      rowGap: 0,

      '> img': {
        alignSelf: 'start',
      },

      '> .plugin-content': {
        minHeight: 0,
        gridArea: '2 / 2 / 4 / 3',

        '> p': {
          margin: theme.spacing(0, 0, 0.5, 0),
        },
      },

      '> .plugin-name': {
        alignSelf: 'center',
        gridArea: '1 / 2 / 2 / 3',
      },
    }),
    pluginType: css({
      gridArea: '1 / 3 / 2 / 4',
      color: theme.colors.text.secondary,
    }),
    pluginLogo: css({
      gridArea: '1 / 1 / 3 / 2',
      maxWidth: '100%',
      alignSelf: 'center',
      objectFit: 'contain',
    }),
    content: css({
      gridArea: '3 / 1 / 4 / 3',
      color: theme.colors.text.secondary,
    }),
    name: css({
      gridArea: '1 / 2 / 3 / 3',
      alignSelf: 'center',
      fontSize: theme.typography.h4.fontSize,
      color: theme.colors.text.primary,
      margin: 0,
    }),
  };
};
