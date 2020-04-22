import React, { useContext } from 'react';
import { stylesFactory, ThemeContext } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { IconButton } from '../IconButton/IconButton';
import { IconName } from '../../types';

interface FilterPillProps {
  selected: boolean;
  label: string;
  onClick: React.MouseEventHandler<HTMLElement>;
  icon?: IconName;
}

export const FilterPill: React.FC<FilterPillProps> = ({ label, selected, onClick, icon = 'check' }) => {
  const theme = useContext(ThemeContext);
  const styles = getFilterPillStyles(theme, selected);
  return (
    <div className={styles.wrapper} onClick={onClick}>
      <IconButton
        name={icon}
        onClick={e => {
          e.stopPropagation();
          onClick(e);
        }}
        className={styles.icon}
        surface="header"
      />
      <span className={styles.label}>{label}</span>
    </div>
  );
};

const getFilterPillStyles = stylesFactory((theme: GrafanaTheme, isSelected: boolean) => {
  const labelColor = isSelected ? theme.colors.text : theme.colors.textWeak;

  return {
    wrapper: css`
      padding: ${theme.spacing.xxs} ${theme.spacing.sm};
      background: ${theme.colors.bg2};
      border-radius: ${theme.border.radius.sm};
      display: inline-block;
      padding: 0 ${theme.spacing.md} 0 ${theme.spacing.xs};
      font-weight: ${theme.typography.weight.semibold};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text};
      display: flex;
      align-items: center;
      height: 32px;
      cursor: pointer;
    `,
    icon: css`
      margin-right: ${theme.spacing.sm};
      margin-left: ${theme.spacing.xs};
      color: ${labelColor};
    `,
    label: css`
      color: ${labelColor};
    `,
  };
});
