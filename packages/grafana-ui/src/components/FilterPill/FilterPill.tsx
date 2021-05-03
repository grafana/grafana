import React from 'react';
import { stylesFactory, useTheme2 } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { IconButton } from '../IconButton/IconButton';
import { IconName } from '../../types';

export interface FilterPillProps {
  selected: boolean;
  label: string;
  onClick: React.MouseEventHandler<HTMLElement>;
  icon?: IconName;
}

export const FilterPill: React.FC<FilterPillProps> = ({ label, selected, onClick, icon = 'check' }) => {
  const theme = useTheme2();
  const styles = getFilterPillStyles(theme, selected);
  return (
    <div className={styles.wrapper} onClick={onClick}>
      <IconButton
        name={icon}
        onClick={(e) => {
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

const getFilterPillStyles = stylesFactory((theme: GrafanaTheme2, isSelected: boolean) => {
  const labelColor = isSelected ? theme.colors.text.primary : theme.colors.text.secondary;

  return {
    wrapper: css`
      padding: ${theme.spacing(0.25)} ${theme.spacing(1)};
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
      padding: ${theme.spacing(0, 2, 0, 0.5)};
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text.primary};
      display: flex;
      align-items: center;
      height: 32px;
      cursor: pointer;
    `,
    icon: css`
      margin-right: ${theme.spacing(1)};
      margin-left: ${theme.spacing(0.5)};
      color: ${labelColor};
    `,
    label: css`
      color: ${labelColor};
    `,
  };
});
