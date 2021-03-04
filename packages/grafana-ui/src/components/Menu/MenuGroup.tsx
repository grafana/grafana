import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';
import { MenuItemProps } from './MenuItem';

/** @internal */
export interface MenuItemsGroup {
  label?: string;
  items: MenuItemProps[];
}
/** @internal */
export interface MenuGroupProps extends Partial<MenuItemsGroup> {
  children?: React.ReactNode;
}

/** @internal */
export const MenuGroup: React.FC<MenuGroupProps> = ({ label, children }) => {
  const styles = useStyles(getStyles);

  return (
    <div>
      {label && <div className={styles.groupLabel}>{label}</div>}
      {children}
    </div>
  );
};
MenuGroup.displayName = 'MenuGroup';

/** @internal */
const getStyles = (theme: GrafanaTheme) => {
  const groupLabelColor = theme.colors.textWeak;
  return {
    groupLabel: css`
      color: ${groupLabelColor};
      font-size: ${theme.typography.size.sm};
      line-height: ${theme.typography.lineHeight.md};
      padding: ${theme.spacing.xs} ${theme.spacing.sm};
    `,
  };
};
