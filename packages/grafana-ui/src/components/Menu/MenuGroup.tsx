import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React from 'react';

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
export const MenuGroup: React.FC<MenuGroupProps> = ({ label, ariaLabel, children }) => {
  const styles = useStyles2(getStyles);
  const labelID = `group-label-${uniqueId()}`;

  return (
    <div role="group" aria-labelledby={!ariaLabel && label ? labelID : undefined} aria-label={ariaLabel}>
      {label && (
        <label id={labelID} className={styles.groupLabel} aria-hidden>
          {label}
        </label>
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
