import React, { useCallback } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme, LinkTarget } from '@grafana/data';
import { List } from '../List/List';
import { useStyles } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';

export interface MenuItem {
  /** Label of the menu item */
  label: string;
  /** Target of the menu item (i.e. new window)  */
  target?: LinkTarget;
  /** Icon of the menu item */
  icon?: IconName;
  /** Url of the menu item */
  url?: string;
  /** Handler for the click behaviour */
  onClick?: (event?: React.SyntheticEvent<HTMLElement>) => void;
  /** Handler for the click behaviour */
  group?: string;
}
export interface MenuItemsGroup {
  /** Label for the menu items group */
  label?: string;
  /** Items of the group */
  items: MenuItem[];
}

export interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** React element rendered at the top of the menu */
  header?: React.ReactNode;
  /** Array of menu items */
  items?: MenuItemsGroup[];
  /** Callback performed when menu is closed */
  onClose?: () => void;
}

/** @public */
export const Menu = React.forwardRef<HTMLDivElement, MenuProps>(({ header, items, onClose, ...otherProps }, ref) => {
  const styles = useStyles(getMenuStyles);
  const onClick = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <div {...otherProps} ref={ref} className={styles.wrapper}>
      {header && <div className={styles.header}>{header}</div>}
      <List
        items={items || []}
        renderItem={item => {
          return <MenuGroup group={item} onClick={onClick} />;
        }}
      />
    </div>
  );
});
Menu.displayName = 'Menu';

interface MenuGroupProps {
  group: MenuItemsGroup;
  onClick?: () => void; // Used with 'onClose'
}

const MenuGroup: React.FC<MenuGroupProps> = ({ group, onClick }) => {
  const styles = useStyles(getMenuStyles);

  if (group.items.length === 0) {
    return null;
  }

  return (
    <div>
      {group.label && <div className={styles.groupLabel}>{group.label}</div>}
      <List
        items={group.items || []}
        renderItem={item => {
          return (
            <MenuItemComponent
              url={item.url}
              label={item.label}
              target={item.target}
              icon={item.icon}
              onClick={(e: React.MouseEvent<HTMLElement>) => {
                // We can have both url and onClick and we want to allow user to open the link in new tab/window
                const isSpecialKeyPressed = e.ctrlKey || e.metaKey || e.shiftKey;
                if (isSpecialKeyPressed && item.url) {
                  return;
                }

                if (item.onClick) {
                  e.preventDefault();
                  item.onClick(e);
                }

                // Typically closes the context menu
                if (onClick) {
                  onClick();
                }
              }}
            />
          );
        }}
      />
    </div>
  );
};
MenuGroup.displayName = 'MenuGroup';

interface MenuItemProps {
  label: string;
  icon?: IconName;
  url?: string;
  target?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

const MenuItemComponent: React.FC<MenuItemProps> = React.memo(({ url, icon, label, target, onClick, className }) => {
  const styles = useStyles(getMenuStyles);
  return (
    <div className={styles.item}>
      <a href={url ? url : undefined} target={target} className={cx(className, styles.link)} onClick={onClick}>
        {icon && <Icon name={icon} className={styles.icon} />} {label}
      </a>
    </div>
  );
});
MenuItemComponent.displayName = 'MenuItemComponent';

const getMenuStyles = (theme: GrafanaTheme) => {
  const { white, black, dark1, dark2, dark7, gray1, gray3, gray5, gray7 } = theme.palette;
  const lightThemeStyles = {
    linkColor: dark2,
    linkColorHover: theme.colors.link,
    wrapperBg: gray7,
    wrapperShadow: gray3,
    itemColor: black,
    groupLabelColor: gray1,
    itemBgHover: gray5,
    headerBg: white,
    headerSeparator: white,
  };
  const darkThemeStyles = {
    linkColor: theme.colors.text,
    linkColorHover: white,
    wrapperBg: dark2,
    wrapperShadow: black,
    itemColor: white,
    groupLabelColor: theme.colors.textWeak,
    itemBgHover: dark7,
    headerBg: dark1,
    headerSeparator: dark7,
  };

  const styles = theme.isDark ? darkThemeStyles : lightThemeStyles;

  return {
    header: css`
      padding: 4px;
      border-bottom: 1px solid ${styles.headerSeparator};
      background: ${styles.headerBg};
      margin-bottom: ${theme.spacing.xs};
      border-radius: ${theme.border.radius.sm} ${theme.border.radius.sm} 0 0;
    `,
    wrapper: css`
      background: ${styles.wrapperBg};
      z-index: 1;
      box-shadow: 0 2px 5px 0 ${styles.wrapperShadow};
      min-width: 200px;
      display: inline-block;
      border-radius: ${theme.border.radius.sm};
    `,
    link: css`
      color: ${styles.linkColor};
      display: flex;
      cursor: pointer;
      &:hover {
        color: ${styles.linkColorHover};
        text-decoration: none;
      }
    `,
    item: css`
      background: none;
      padding: 4px 8px;
      color: ${styles.itemColor};
      border-left: 2px solid transparent;
      cursor: pointer;
      &:hover {
        background: ${styles.itemBgHover};
        border-image: linear-gradient(#f05a28 30%, #fbca0a 99%);
        border-image-slice: 1;
      }
    `,
    groupLabel: css`
      color: ${styles.groupLabelColor};
      font-size: ${theme.typography.size.sm};
      line-height: ${theme.typography.lineHeight.md};
      padding: ${theme.spacing.xs} ${theme.spacing.sm};
    `,
    icon: css`
      opacity: 0.7;
      margin-right: 10px;
      color: ${theme.colors.linkDisabled};
    `,
  };
};
