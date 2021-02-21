import React, { useCallback } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme, LinkTarget } from '@grafana/data';
import { List } from '../List/List';
import { styleMixins, useStyles } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';

/** @internal */
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
  /** Active */
  active?: boolean;
}

/** @internal */
export interface MenuItemsGroup {
  /** Label for the menu items group */
  label?: string;
  /** Items of the group */
  items: MenuItem[];
}

/** @internal */
export interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** React element rendered at the top of the menu */
  header?: React.ReactNode;
  /** Array of menu items */
  items?: MenuItemsGroup[];
  /** Callback performed when menu is closed */
  onClose?: () => void;
}

/** @internal */
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
        renderItem={(item) => {
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
        renderItem={(item) => {
          return (
            <MenuItemComponent
              url={item.url}
              label={item.label}
              target={item.target}
              icon={item.icon}
              active={item.active}
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
  target?: LinkTarget;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  active?: boolean;
}

const MenuItemComponent: React.FC<MenuItemProps> = React.memo(
  ({ url, icon, label, target, onClick, className, active }) => {
    const styles = useStyles(getMenuStyles);
    const itemStyle = cx(
      {
        [styles.item]: true,
        [styles.activeItem]: active,
      },
      className
    );

    return (
      <div className={itemStyle}>
        <a
          href={url ? url : undefined}
          target={target}
          className={styles.link}
          onClick={onClick}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        >
          {icon && <Icon name={icon} className={styles.icon} />} {label}
        </a>
      </div>
    );
  }
);
MenuItemComponent.displayName = 'MenuItemComponent';

const getMenuStyles = (theme: GrafanaTheme) => {
  const linkColor = theme.colors.text;
  const linkColorHover = theme.colors.linkHover;
  const wrapperBg = theme.colors.formInputBg;
  const wrapperShadow = theme.isDark ? theme.palette.black : theme.palette.gray3;
  const groupLabelColor = theme.colors.textWeak;
  const itemBgHover = styleMixins.hoverColor(theme.colors.bg1, theme);
  const headerBg = theme.colors.formInputBg;
  const headerSeparator = theme.colors.border3;

  return {
    header: css`
      padding: 4px;
      border-bottom: 1px solid ${headerSeparator};
      background: ${headerBg};
      margin-bottom: ${theme.spacing.xs};
      border-radius: ${theme.border.radius.sm} ${theme.border.radius.sm} 0 0;
    `,
    wrapper: css`
      background: ${wrapperBg};
      box-shadow: 0 2px 5px 0 ${wrapperShadow};
      display: inline-block;
      border-radius: ${theme.border.radius.sm};
    `,
    link: css`
      color: ${linkColor};
      display: flex;
      cursor: pointer;
      padding: 5px 12px 5px 10px;

      &:hover {
        color: ${linkColorHover};
        text-decoration: none;
      }
    `,
    item: css`
      background: none;
      border-left: 2px solid transparent;
      cursor: pointer;
      white-space: nowrap;

      &:hover {
        background: ${itemBgHover};
        border-image: linear-gradient(#f05a28 30%, #fbca0a 99%);
        border-image-slice: 1;
      }
    `,
    activeItem: css`
      background: ${theme.colors.bg2};
    `,
    groupLabel: css`
      color: ${groupLabelColor};
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
