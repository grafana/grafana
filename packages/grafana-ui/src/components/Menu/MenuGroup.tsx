import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';
import { MenuItemProps } from './MenuItem';

export interface MenuGroupProps {
  label?: string;
  children?: React.ReactNode;
  item?: MenuItemProps[];
}
export interface MenuItemsGroup extends MenuGroupProps {
  item?: MenuItemProps[];
}

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
