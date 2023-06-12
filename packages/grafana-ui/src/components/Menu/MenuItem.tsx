import { css, cx } from '@emotion/css';
import React, { ReactElement, useCallback, useState, useRef, useImperativeHandle, CSSProperties } from 'react';

import { GrafanaTheme2, LinkTarget } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';

import { SubMenu } from './SubMenu';

/** @internal */
export type MenuItemElement = HTMLAnchorElement & HTMLButtonElement & HTMLDivElement;

/** @internal */
export interface MenuItemProps<T = any> {
  /** Label of the menu item */
  label: string;
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
    const itemStyle = cx(
      {
        [styles.item]: true,
        [styles.active]: isActive,
        [styles.disabled]: disabled,
        [styles.destructive]: destructive && !disabled,
      },
      className
    );
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
      <ItemElement
        target={target}
        className={itemStyle}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        href={url}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyDown={handleKeys}
        role={url === undefined ? role : undefined}
        data-role="menuitem" // used to identify menuitem in Menu.tsx
        ref={localRef}
        data-testid={testId}
        aria-label={ariaLabel}
        aria-checked={ariaChecked}
        tabIndex={tabIndex}
        {...disabledProps}
      >
        <>
          {icon && <Icon name={icon} className={styles.icon} aria-hidden />}
          {label}

          <div className={cx(styles.rightWrapper, { [styles.withShortcut]: hasShortcut })}>
            {hasShortcut && (
              <div className={styles.shortcut}>
                <Icon name="keyboard" aria-hidden />
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
    );
  })
);

MenuItem.displayName = 'MenuItem';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    item: css`
      background: none;
      cursor: pointer;
      white-space: nowrap;
      color: ${theme.colors.text.primary};
      display: flex;
      align-items: center;
      padding: ${theme.spacing(0.5, 2)};
      min-height: ${theme.spacing(4)};
      margin: 0;
      border: none;
      width: 100%;
      position: relative;

      &:hover,
      &:focus,
      &:focus-visible {
        background: ${theme.colors.action.hover};
        color: ${theme.colors.text.primary};
        text-decoration: none;
      }

      &:focus-visible {
        ${getFocusStyles(theme)}
      }
    `,
    active: css`
      background: ${theme.colors.action.hover};
    `,
    destructive: css`
      color: ${theme.colors.error.text};

      svg {
        color: ${theme.colors.error.text};
      }

      &:hover,
      &:focus,
      &:focus-visible {
        background: ${theme.colors.error.main};
        color: ${theme.colors.error.contrastText};

        svg {
          color: ${theme.colors.error.contrastText};
        }
      }
    `,
    disabled: css`
      color: ${theme.colors.action.disabledText};

      &:hover,
      &:focus,
      &:focus-visible {
        cursor: not-allowed;
        background: none;
        color: ${theme.colors.action.disabledText};
      }
    `,
    icon: css`
      opacity: 0.7;
      margin-right: 10px;
      margin-left: -4px;
      color: ${theme.colors.text.secondary};
    `,
    rightWrapper: css`
      display: flex;
      align-items: center;
      margin-left: auto;
    `,
    shortcutIcon: css`
      margin-right: ${theme.spacing(1)};
    `,
    withShortcut: css`
      min-width: ${theme.spacing(10.5)};
    `,
    shortcut: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
      margin-left: ${theme.spacing(2)};
      color: ${theme.colors.text.secondary};
      opacity: 0.7;
    `,
  };
};
