import { css, cx } from '@emotion/css';
import React, { ReactElement, useCallback, useState, useRef, useImperativeHandle, CSSProperties } from 'react';

import { GrafanaTheme2, LinkTarget } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';
import { IconName } from '../../types/icon';
import { Icon } from '../Icon/Icon';

import { SubMenu } from './SubMenu';

/** @internal */
export type MenuItemElement = HTMLAnchorElement & HTMLButtonElement & HTMLDivElement;

/** @internal */
export interface MenuItemProps<T = unknown> {
  /** Label of the menu item */
  label: string;
  /** Description of item */
  description?: string;
  /** Aria label for accessibility support */
  ariaLabel?: string;
  /** Aria checked for accessibility support */
  ariaChecked?: boolean;
  /** Target of the menu item (i.e. new window)  */
  target?: LinkTarget;
  /** Icon of the menu item */
  icon?: IconName;
  /** Role of the menu item */
  role?: string;
  /** Url of the menu item */
  url?: string;
  /** Handler for the click behaviour */
  onClick?: (event: React.MouseEvent<HTMLElement>, payload?: T) => void;
  /** Custom MenuItem styles*/
  className?: string;
  /** Active */
  active?: boolean;
  /** Disabled */
  disabled?: boolean;
  /** Show in destructive style (error color) */
  destructive?: boolean;
  tabIndex?: number;
  /** List of menu items for the subMenu */
  childItems?: Array<ReactElement<MenuItemProps>>;
  /** Custom style for SubMenu */
  customSubMenuContainerStyles?: CSSProperties;
  /** Shortcut key combination */
  shortcut?: string;
  /** Test id for e2e tests and fullstory*/
  testId?: string;
}

/** @internal */
export const MenuItem = React.memo(
  React.forwardRef<MenuItemElement, MenuItemProps>((props, ref) => {
    const {
      url,
      icon,
      label,
      description,
      ariaLabel,
      ariaChecked,
      target,
      onClick,
      className,
      active,
      disabled,
      destructive,
      childItems,
      role = 'menuitem',
      tabIndex = -1,
      customSubMenuContainerStyles,
      shortcut,
      testId,
    } = props;
    const styles = useStyles2(getStyles);
    const [isActive, setIsActive] = useState(active);
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    const [openedWithArrow, setOpenedWithArrow] = useState(false);
    const onMouseEnter = useCallback(() => {
      if (disabled) {
        return;
      }

      setIsSubMenuOpen(true);
      setIsActive(true);
    }, [disabled]);
    const onMouseLeave = useCallback(() => {
      if (disabled) {
        return;
      }

      setIsSubMenuOpen(false);
      setIsActive(false);
    }, [disabled]);

    const hasSubMenu = childItems && childItems.length > 0;
    const ItemElement = hasSubMenu ? 'div' : url === undefined ? 'button' : 'a';
    const itemWrapperStyle = cx(
      {
        [styles.menuItemWrapper]: true,
        [styles.active]: isActive,
        [styles.destructive]: destructive && !disabled,
      },
      className
    );

    const itemStyle = cx({
      [styles.item]: true,
      [styles.disabled]: disabled,
    });

    const disabledProps = {
      [ItemElement === 'button' ? 'disabled' : 'aria-disabled']: disabled,
      ...(ItemElement === 'a' && disabled && { href: undefined, onClick: undefined }),
      ...(disabled && {
        tabIndex: -1,
        ['data-disabled']: disabled, // used to identify disabled items in Menu.tsx
      }),
    };

    const localRef = useRef<MenuItemElement>(null);
    useImperativeHandle(ref, () => localRef.current!);

    const handleKeys = (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          event.stopPropagation();
          if (hasSubMenu) {
            setIsSubMenuOpen(true);
            setOpenedWithArrow(true);
            setIsActive(true);
          }
          break;
        default:
          break;
      }
    };

    const closeSubMenu = () => {
      setIsSubMenuOpen(false);
      setIsActive(false);
      localRef?.current?.focus();
    };

    const hasShortcut = Boolean(shortcut && shortcut.length > 0);

    return (
      <div
        tabIndex={tabIndex}
        className={itemWrapperStyle}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyDown={handleKeys}
        ref={localRef}
      >
        <ItemElement
          tabIndex={-1}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          href={url}
          data-testid={testId}
          aria-label={ariaLabel}
          aria-checked={ariaChecked}
          className={itemStyle}
          data-role="menuitem"
          role={url === undefined ? role : undefined}
          {...disabledProps}
        >
          <>
            {icon && <Icon name={icon} className={styles.icon} aria-hidden />}
            {label}
            <div className={cx(styles.rightWrapper, { [styles.withShortcut]: hasShortcut })}>
              {hasShortcut && (
                <div className={styles.shortcut}>
                  <Icon name="keyboard" title="keyboard shortcut" />
                  {shortcut}
                </div>
              )}
              {hasSubMenu && (
                <SubMenu
                  items={childItems}
                  isOpen={isSubMenuOpen}
                  openedWithArrow={openedWithArrow}
                  setOpenedWithArrow={setOpenedWithArrow}
                  close={closeSubMenu}
                  customStyle={customSubMenuContainerStyles}
                />
              )}
            </div>
          </>
        </ItemElement>
        {description && (
          <div
            className={cx(styles.description, {
              [styles.descriptionWithIcon]: icon !== undefined,
            })}
          >
            {description}
          </div>
        )}
      </div>
    );
  })
);

MenuItem.displayName = 'MenuItem';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    menuItemWrapper: css({
      label: 'menu-item-wrapper',
      background: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      padding: theme.spacing(0.5, 2),
      minHeight: theme.spacing(4),
      margin: 0,
      border: 'none',
      width: '100%',
      position: 'relative',
      flexWrap: 'wrap',
      cursor: 'pointer',
      '&:hover, &:focus, &:focus-visible': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
        textDecoration: 'none',
      },
      '&:focus-visible': getFocusStyles(theme),
    }),
    item: css({
      label: 'menu-item',
      background: 'none',
      whiteSpace: 'nowrap',
      color: theme.colors.text.primary,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      margin: 0,
      border: 'none',
      padding: 0,
      width: '100%',

      // wrapper is handling the focus styles
      '&:focus-visible': {
        outline: 'none',
        boxShadow: 'none',
      },
    }),
    active: css({
      background: theme.colors.action.hover,
    }),
    destructive: css({
      color: theme.colors.error.text,

      svg: {
        color: theme.colors.error.text,
      },

      '&:hover, &:focus, &:focus-visible': {
        background: theme.colors.error.main,
        color: theme.colors.error.contrastText,

        svg: {
          color: theme.colors.error.contrastText,
        },
      },
    }),
    disabled: css({
      color: theme.colors.action.disabledText,
      label: 'menu-item-disabled',
      '&:hover, &:focus, &:focus-visible': {
        cursor: 'not-allowed',
        background: 'none',
        color: theme.colors.action.disabledText,
      },
    }),
    icon: css({
      opacity: 0.7,
      marginRight: '10px',
      marginLeft: '-4px',
      color: theme.colors.text.secondary,
    }),
    rightWrapper: css({
      display: 'flex',
      alignItems: 'center',
      marginLeft: 'auto',
    }),
    shortcutIcon: css({
      marginRight: theme.spacing(1),
    }),
    withShortcut: css({
      minWidth: theme.spacing(10.5),
    }),
    shortcut: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginLeft: theme.spacing(2),
      color: theme.colors.text.secondary,
      opacity: 0.7,
    }),
    description: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    descriptionWithIcon: css({
      marginLeft: theme.spacing(3),
    }),
  };
};
