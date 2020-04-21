import React, { useContext } from 'react';
import { stylesFactory, ThemeContext } from '../../themes';
import { Icon } from '..';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

interface FilterPillProps {
  selected: boolean;
  label: string;
  onClick: React.MouseEventHandler<HTMLElement>;
}

export const FilterPill: React.FC<FilterPillProps> = ({ label, selected, onClick }) => {
  const theme = useContext(ThemeContext);
  const styles = getFilterPillStyles(theme, selected);
  return (
    <div className={styles.wrapper} onClick={onClick}>
      <Icon className={styles.icon} name="check" />
      {label}
    </div>
  );
};

const getFilterPillStyles = stylesFactory((theme: GrafanaTheme, isSelected: boolean) => {
  const selectedIcon = theme.isLight ? theme.palette.blue77 : theme.palette.blue95;
  return {
    wrapper: css`
      padding: ${theme.spacing.xxs} ${theme.spacing.sm};
      background: ${theme.colors.bg2};
      border-radius: ${theme.border.radius.sm};
      display: inline-block;
      cursor: pointer;
      padding: ${theme.spacing.xs} ${theme.spacing.md} ${theme.spacing.xs} ${theme.spacing.xs};
      font-weight: ${theme.typography.weight.semibold};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text};
      display: flex;
      align-items: center;
      height: 32px;
    `,
    icon: css`
      margin-right: ${theme.spacing.xs};
      color: ${isSelected ? selectedIcon : theme.colors.textFaint};
    `,
  };
});
