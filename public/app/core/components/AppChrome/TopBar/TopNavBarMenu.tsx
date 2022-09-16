import { css } from '@emotion/css';
import { i18n } from '@lingui/core';
import React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Menu, MenuItem, useStyles2 } from '@grafana/ui';

import menuItemTranslations from '../../NavBar/navBarItem-translations';

export interface TopNavBarMenuProps {
  node: NavModelItem;
}

export function TopNavBarMenu({ node }: TopNavBarMenuProps) {
  const styles = useStyles2(getStyles);
  if (!node) {
    return null;
  }

  return (
    <Menu
      header={
        <div onClick={(e) => e.stopPropagation()} className={styles.header}>
          <div>{node.text}</div>
          {node.subTitle && <div className={styles.subTitle}>{node.subTitle}</div>}
        </div>
      }
    >
      {node.children?.map((item) => {
        const translationKey = item.id && menuItemTranslations[item.id];
        const itemText = translationKey ? i18n._(translationKey) : item.text;
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
