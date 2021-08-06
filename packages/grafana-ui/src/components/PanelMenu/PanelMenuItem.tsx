import React from 'react';
import { css } from '@emotion/css';

import { GrafanaTheme2, PanelMenuItem } from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';
import { useStyles2 } from '../../themes';

// Converts shortcuts to aria-keyshortcuts format. (See https://www.digitala11y.com/aria-keyshortcutsproperties/)
function convertShortcutToAria(shortcut: string): string {
  return shortcut.toUpperCase().replace(' ', '+');
}

interface Props {
  item: PanelMenuItem;
  children?: React.ReactNode;
}

export const PanelMenuListItem = ({ item, children }: Props) => {
  const styles = useStyles2(panelMenuItemStyles);
  return (
    <li className={styles.subMenuItemList} role="none">
      <button
        onClick={item.onClick}
        role="menuitem"
        tabIndex={-1}
        className={styles.menuItem}
        aria-keyshortcuts={item.shortcut && convertShortcutToAria(item.shortcut)}
      >
        <Icon name={item.iconClassName as IconName} className={styles.icon} aria-hidden />
        <span className={styles.menuItemText}>{item.text}</span>
        {item.shortcut && (
          <div className={styles.shortcutContainer}>
            <Icon name="keyboard" className={styles.shortcutIcon} aria-hidden />
            <span className={styles.shortcutText} aria-hidden>
              {item.shortcut}
            </span>
          </div>
        )}
        {children && <Icon name="angle-right" className={styles.angleRight} aria-hidden />}
      </button>
      {children}
    </li>
  );
};

const panelMenuItemStyles = (theme: GrafanaTheme2) => {
  return {
    menuItem: css`
      position: relative;
      display: flex;
      align-items: center;

      background-color: transparent;
      border: none;
      margin-top: 2px;
      width: 100%;
      text-align: left;
      padding: 5px 10px 5px 10px;
    `,
    angleRight: css`
      position: absolute;
      top: 7px;
      right: 4px;
      margin-bottom: 2px;
      color: ${theme.v1.colors.textWeak};
    `,
    subMenuItemList: css`
      position: relative;
      display: block;
      list-style: none;

      > #panel-menu {
        display: none;
        width: max-content;
      }

      &:hover,
      :focus-within {
        background-color: ${theme.colors.action.hover};

        > button {
          color: ${theme.colors.text.maxContrast};
        }

        > #panel-menu {
          display: flex;
          top: -1px;
          left: 100%;
          right: -100%;
        }
      }
    `,
    icon: css`
      margin-right: ${theme.spacing(1)};
    `,
    menuItemText: css`
      flex-grow: 1;
    `,
    shortcutContainer: css`
      min-width: 47px;
      margin-left: ${theme.spacing(2)};
    `,
    shortcutText: css`
      color: ${theme.v1.colors.textWeak};
    `,
    shortcutIcon: css`
      color: ${theme.v1.colors.textWeak};
      margin-right: ${theme.spacing(1)};
    `,
  };
};
