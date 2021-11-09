import React from 'react';
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
}

/** @internal */
export const MenuItem = React.memo(
  React.forwardRef<HTMLAnchorElement & HTMLButtonElement, MenuItemProps>((props, ref) => {
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
      role = 'menuitem',
      tabIndex = -1,
    } = props;
    const styles = useStyles2(getStyles);
    const itemStyle = cx(
      {
        [styles.item]: true,
        [styles.activeItem]: active,
      },
      className
    );

    const Wrapper = url === undefined ? 'button' : 'a';
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
                  onClick(event);
                }
              }
            : undefined
        }
        role={url === undefined ? role : undefined}
        data-role="menuitem" // used to identify menuitem in Menu.tsx
        ref={ref}
        aria-label={ariaLabel}
        aria-checked={ariaChecked}
        tabIndex={tabIndex}
      >
        {icon && <Icon name={icon} className={styles.icon} aria-hidden />} {label}
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
  };
};
