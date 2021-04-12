import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';
import { MenuItemProps } from './MenuItem';

/** @internal */
export interface MenuItemsGroup {
  /** Label for the menu items group */
  label?: string;
  /** Aria label for accessibility support */
  ariaLabel?: string;
  /** Items of the group */
  items: MenuItemProps[];
}
/** @internal */
export interface MenuGroupProps extends Partial<MenuItemsGroup> {
  /** special children prop to pass children elements */
  children: React.ReactNode;
}

/** @internal */
export const MenuGroup: React.FC<MenuGroupProps> = ({ label, children, ariaLabel }) => {
  const styles = useStyles(getStyles);

  return (
    <div>
      {label && (
        <div className={styles.groupLabel} aria-label={ariaLabel}>
          {label}
        </div>
      )}
      {children}
    </div>
  );
};
MenuGroup.displayName = 'MenuGroup';

/** @internal */
const getStyles = (theme: GrafanaTheme) => {
  return {
    groupLabel: css`
      color: ${theme.v2.palette.text.secondary};
      font-size: ${theme.v2.typography.size.sm};
      padding: ${theme.v2.spacing(0.5, 1)};
    `,
  };
};
