import React, { ReactElement, useCallback, useMemo, useState, useRef, useImperativeHandle } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, LinkTarget } from '@grafana/data';
import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';
import { SubMenu } from './SubMenu';
import { getFocusStyles } from '../../themes/mixins';

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
  onClick?: (event?: React.SyntheticEvent<HTMLElement>, payload?: T) => void;
  /** Custom MenuItem styles*/
  className?: string;
  /** Active */
  active?: boolean;

  tabIndex?: number;

  /** List of menu items for the subMenu */
  childItems?: Array<ReactElement<MenuItemProps>>;
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
      childItems,
      role = 'menuitem',
      tabIndex = -1,
    } = props;
    const styles = useStyles2(getStyles);
    const [isActive, setIsActive] = useState(active);
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    const [openedWithArrow, setOpenedWithArrow] = useState(false);
    const onMouseEnter = useCallback(() => {
      setIsSubMenuOpen(true);
      setIsActive(true);
    }, []);
    const onMouseLeave = useCallback(() => {
      setIsSubMenuOpen(false);
      setIsActive(false);
    }, []);
    const hasSubMenu = useMemo(() => childItems && childItems.length > 0, [childItems]);
    const Wrapper = hasSubMenu ? 'div' : url === undefined ? 'button' : 'a';
    const itemStyle = cx(
      {
        [styles.item]: true,
        [styles.activeItem]: isActive,
      },
      className
    );

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

    return (
      <Wrapper
        target={target}
        className={itemStyle}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        href={url}
        onClick={
          onClick
            ? (event) => {
                if (!(event.ctrlKey || event.metaKey || event.shiftKey) && onClick) {
                  event.preventDefault();
                  event.stopPropagation();
                  onClick(event);
                }
              }
            : undefined
        }
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyDown={handleKeys}
        role={url === undefined ? role : undefined}
        data-role="menuitem" // used to identify menuitem in Menu.tsx
        ref={localRef}
        aria-label={ariaLabel}
        aria-checked={ariaChecked}
        tabIndex={tabIndex}
      >
        {icon && <Icon name={icon} className={styles.icon} aria-hidden />}
        {label}
        {hasSubMenu && (
          <SubMenu
            items={childItems}
            isOpen={isSubMenuOpen}
            openedWithArrow={openedWithArrow}
            setOpenedWithArrow={setOpenedWithArrow}
            close={closeSubMenu}
          />
        )}
      </Wrapper>
    );
  })
);
MenuItem.displayName = 'MenuItem';

/** @internal */
const getStyles = (theme: GrafanaTheme2) => {
  return {
    item: css`
      background: none;
      cursor: pointer;
      white-space: nowrap;
      color: ${theme.colors.text.primary};
      display: flex;
      padding: 5px 12px 5px 10px;
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
    activeItem: css`
      background: ${theme.colors.action.selected};
    `,
    icon: css`
      opacity: 0.7;
      margin-right: 10px;
      color: ${theme.colors.text.secondary};
    `,
  };
};
