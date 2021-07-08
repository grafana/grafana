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
  ariaLabel: string;
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
}

/** @internal */
export const MenuItem: React.FC<MenuItemProps> = React.memo(
  ({ url, icon, label, ariaLabel, target, onClick, className, active }) => {
    const styles = useStyles2(getStyles);
    const itemStyle = cx(
      {
        [styles.item]: true,
        [styles.activeItem]: active,
      },
      className
    );

    return (
      <div className={itemStyle} aria-label={ariaLabel}>
        <a
          href={url ? url : undefined}
          target={target}
          className={styles.link}
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
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        >
          {icon && <Icon name={icon} className={styles.icon} />} {label}
        </a>
      </div>
    );
  }
);
MenuItem.displayName = 'MenuItem';

/** @internal */
const getStyles = (theme: GrafanaTheme2) => {
  return {
    link: css`
      color: ${theme.colors.text.primary};
      display: flex;
      cursor: pointer;
      padding: 5px 12px 5px 10px;

      &:hover {
        color: ${theme.colors.text.primary};
        text-decoration: none;
      }
    `,
    item: css`
      background: none;
      cursor: pointer;
      white-space: nowrap;

      &:hover {
        background: ${theme.colors.action.hover};
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
