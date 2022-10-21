import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Menu, MenuItem, useStyles2 } from '@grafana/ui';

import { getNavTitle } from '../../NavBar/navBarItem-translations';
import { enrichConfigItems, enrichWithInteractionTracking } from '../../NavBar/utils';

export interface TopNavBarMenuProps {
  node: NavModelItem;
}

export function TopNavBarMenu({ node: nodePlain }: TopNavBarMenuProps) {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const enriched = enrichConfigItems([cloneDeep(nodePlain)], location);
  const node = enrichWithInteractionTracking(enriched[0], false);

  if (!node) {
    return null;
  }

  return (
    <Menu
      header={
        <div onClick={(e) => e.stopPropagation()} className={styles.header}>
          <div>{getNavTitle(node.id) ?? node.text}</div>
          {node.subTitle && <div className={styles.subTitle}>{node.subTitle}</div>}
        </div>
      }
    >
      {node.children?.map((item) => {
        const itemText = getNavTitle(item.id) ?? item.text;
        const showExternalLinkIcon = /^https?:\/\//.test(item.url || '');
        return item.url ? (
          <MenuItem
            url={item.url}
            label={itemText}
            icon={showExternalLinkIcon ? 'external-link-alt' : undefined}
            target={item.target}
            key={item.id}
          />
        ) : (
          <MenuItem icon={item.icon} onClick={item.onClick} label={itemText} key={item.id} />
        );
      })}
    </Menu>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.h5.fontWeight,
      padding: theme.spacing(0.5, 1),
      whiteSpace: 'nowrap',
    }),
    subTitle: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
