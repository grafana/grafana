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
  const onNavigate = (item: NavModelItem) => {
    const { url, target, onClick } = item;
    onClick?.();

    if (url) {
      window.open(url, target);
    }
  };

  return (
    <Menu>
      <MenuItem url={node.url} label={node.text} className={styles.header} />
      {node.children?.map((item) => {
        const translationKey = item.id && menuItemTranslations[item.id];
        const itemText = translationKey ? i18n._(translationKey) : item.text;

        return !item.target && item.url?.startsWith('/') ? (
          <MenuItem url={item.url} label={itemText} key={item.id} />
        ) : (
          <MenuItem onClick={() => onNavigate(item)} label={itemText} key={item.id} />
        );
      })}
      {node.subTitle && (
        // Stopping the propagation of the event when clicking the subTitle so the menu
        // does not close
        <div onClick={(e) => e.stopPropagation()} className={styles.subtitle}>
          {node.subTitle}
        </div>
      )}
    </Menu>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    subtitle: css`
      background-color: transparent;
      border-top: 1px solid ${theme.colors.border.weak};
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.bodySmall.fontWeight};
      padding: ${theme.spacing(1)} ${theme.spacing(2)} ${theme.spacing(1)};
      text-align: left;
      white-space: nowrap;
    `,
    header: css({
      height: `calc(${theme.spacing(6)} - 1px)`,
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.h4.fontWeight,
      padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
      whiteSpace: 'nowrap',
      width: '100%',
      background: theme.colors.background.secondary,
    }),
  };
};
