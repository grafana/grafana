import React, { ReactNode, useState, useRef, useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, LinkTarget } from '@grafana/data';
import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';

/** @internal */
export interface MenuItemProps<T = any> {
  /** Label of the menu item */
  label: string;
  /** Aria label for accessibility support */
  ariaLabel?: string;
  /** Target of the menu item (i.e. new window)  */
  target?: LinkTarget;
  /** Icon of the menu item */
  icon?: IconName;
  /** Url of the menu item */
  url?: string;
  /** Handler for the click behaviour */
  onClick?: (event?: React.SyntheticEvent<HTMLElement>, payload?: T) => void;
  /** Custom MenuItem styles*/
  className?: string;
  /** Active */
  active?: boolean;

  tabIndex?: number;

  children?: ReactNode;
}

/** @internal */
export const MenuItem = React.memo(
  React.forwardRef<HTMLAnchorElement & HTMLButtonElement, MenuItemProps>(
    ({ url, icon, label, ariaLabel, target, onClick, className, active, tabIndex = -1, children }, ref) => {
      const styles = useStyles2(getStyles);
      const itemStyle = cx(
        {
          [styles.item]: true,
          [styles.activeItem]: active,
        },
        className
      );
      const [hover, setHover] = useState(false);
      const subMenuRef = useRef(null);
      const onMouseEnter = useCallback(() => setHover(true), []);
      const onMouseLeave = useCallback(() => setHover(false), []);

      const Wrapper = children || url === undefined ? 'button' : 'a';
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
          role={url === undefined ? 'menuitem' : undefined}
          data-role="menuitem" // used to identify menuitem in Menu.tsx
          ref={ref}
          aria-label={ariaLabel}
          tabIndex={tabIndex}
        >
          {icon && <Icon name={icon} className={styles.icon} aria-hidden />} {label}
          {children && (
            <div className={styles.subMenuIconWrapper}>
              <Icon name="angle-right" className={styles.subMenuIcon} aria-hidden />
            </div>
          )}
          {
            <div ref={subMenuRef} className={styles.subMenu(!!children && hover, subMenuRef.current)}>
              {children}
            </div>
          }
        </Wrapper>
      );
    }
  )
);
MenuItem.displayName = 'MenuItem';

/** @internal */
const getStyles = (theme: GrafanaTheme2) => {
  return {
    item: css`
      position: relative;
      background: none;
      cursor: pointer;
      white-space: nowrap;
      color: ${theme.colors.text.primary};
      display: flex;
      padding: 5px 12px 5px 10px;
      margin: 0;
      border: none;
      width: 100%;

      &:hover,
      &:focus,
      &:focus-visible {
        background: ${theme.colors.action.hover};
        color: ${theme.colors.text.primary};
        text-decoration: none;
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
    subMenuIcon: css`
      opacity: 0.7;
      margin-left: 10px;
      color: ${theme.colors.text.secondary};
    `,
    subMenuIconWrapper: css`
      display: flex;
      flex: 1;
      justify-content: end;
    `,
    subMenu: (show: boolean, element: HTMLElement | null) => css`
      position: absolute;
      top: 0;
      visibility: ${show ? 'visible' : 'hidden'};
      z-index: ${theme.zIndex.dropdown};
      ${getPosition(element)}: 100%;
    `,
  };
};

const getPosition = (element: HTMLElement | null) => {
  if (!element) {
    return 'left';
  }

  const wrapperPos = element.parentElement!.getBoundingClientRect();
  const pos = element.getBoundingClientRect();

  if (pos.width === 0) {
    return 'left';
  }

  if (wrapperPos.right + pos.width + 10 > window.innerWidth) {
    return 'right';
  } else {
    return 'left';
  }
};
