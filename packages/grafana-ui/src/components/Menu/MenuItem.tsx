import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme, LinkTarget } from '@grafana/data';
import { styleMixins, useStyles } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';

/** @internal */
export interface MenuItemProps {
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
  onClick?: (event?: React.SyntheticEvent<HTMLElement>) => void;
  /** Custom MenuItem styles*/
  className?: string;
  /** Active */
  active?: boolean;
}

/** @internal */
export const MenuItem: React.FC<MenuItemProps> = React.memo(
  ({ url, icon, label, ariaLabel, target, onClick, className, active }) => {
    const styles = useStyles(getStyles);
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
          onClick={onClick}
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
const getStyles = (theme: GrafanaTheme) => {
  const linkColor = theme.colors.text;
  const linkColorHover = theme.colors.linkHover;
  const itemBgHover = styleMixins.hoverColor(theme.colors.bg1, theme);

  return {
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
    icon: css`
      opacity: 0.7;
      margin-right: 10px;
      color: ${theme.colors.linkDisabled};
    `,
  };
};
