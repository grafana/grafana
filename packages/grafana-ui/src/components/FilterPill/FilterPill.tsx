import React from 'react';
import { useStyles2 } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { IconButton } from '../IconButton/IconButton';
import { IconName } from '../../types';

export interface FilterPillProps {
  selected: boolean;
  label: string;
  onClick: React.MouseEventHandler<HTMLElement>;
  icon?: IconName;
}

export const FilterPill: React.FC<FilterPillProps> = ({ label, selected, onClick, icon = 'check' }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.wrapper, selected && styles.selected)} onClick={onClick}>
      <span>{label}</span>
      {selected && (
        <IconButton
          name={icon}
          onClick={(e) => {
            e.stopPropagation();
            onClick(e);
          }}
          className={styles.icon}
          surface="header"
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      padding: ${theme.spacing(0.25)} ${theme.spacing(1)};
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius(8)};
      padding: ${theme.spacing(0, 2)};
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text.secondary};
      display: flex;
      align-items: center;
      height: 32px;
      cursor: pointer;
    `,
    selected: css`
      color: ${theme.colors.text.primary};
      background: ${theme.colors.action.selected};
    `,
    icon: css`
      margin: ${theme.spacing(0, 0, 0, 1)};
    `,
  };
};
