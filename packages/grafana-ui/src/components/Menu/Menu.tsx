import React, { useCallback } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { List } from '../List/List';
import { useStyles } from '../../themes';
import { ItemProps, MenuItem } from './MenuItem';

/** @internal */
export interface MenuItemsGroup {
  /** Label for the menu items group */
  label?: string;
  /** Items of the group */
  items: ItemProps[];
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
            <MenuItem
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

const getMenuStyles = (theme: GrafanaTheme) => {
  const wrapperBg = theme.colors.formInputBg;
  const wrapperShadow = theme.isDark ? theme.palette.black : theme.palette.gray3;
  const groupLabelColor = theme.colors.textWeak;
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
    groupLabel: css`
      color: ${groupLabelColor};
      font-size: ${theme.typography.size.sm};
      line-height: ${theme.typography.lineHeight.md};
      padding: ${theme.spacing.xs} ${theme.spacing.sm};
    `,
  };
};
