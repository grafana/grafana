import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '../../themes';
import { MenuItemProps } from './MenuItem';

/** @internal */
export interface MenuItemsGroup<T = any> {
  /** Label for the menu items group */
  label?: string;
  /** Aria label for accessibility support */
  ariaLabel?: string;
  /** Items of the group */
  items: Array<MenuItemProps<T>>;
}
/** @internal */
export interface MenuGroupProps extends Partial<MenuItemsGroup> {
  /** special children prop to pass children elements */
  children: React.ReactNode;
}

/** @internal */
export const MenuGroup: React.FC<MenuGroupProps> = ({ label, children, ariaLabel }) => {
  const styles = useStyles2(getStyles);

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
const getStyles = (theme: GrafanaTheme2) => {
  return {
    groupLabel: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.size.sm};
      padding: ${theme.spacing(0.5, 1)};
    `,
  };
};
