import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { IconName } from '../../types';
import { clearButtonStyles } from '../Button';
import { Icon } from '../Icon/Icon';

export interface FilterPillProps {
  selected: boolean;
  label: string;
  onClick: React.MouseEventHandler<HTMLElement>;
  icon?: IconName;
}

export const FilterPill = ({ label, selected, onClick, icon = 'check' }: FilterPillProps) => {
  const styles = useStyles2(getStyles);
  const clearButton = useStyles2(clearButtonStyles);
  return (
    <button type="button" className={cx(clearButton, styles.wrapper, selected && styles.selected)} onClick={onClick}>
      <span>{label}</span>
      {selected && <Icon name={icon} className={styles.icon} />}
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius(8)};
      padding: ${theme.spacing(0, 2)};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      line-height: ${theme.typography.bodySmall.lineHeight};
      color: ${theme.colors.text.secondary};
      display: flex;
      align-items: center;
      height: 32px;

      &:hover {
        background: ${theme.colors.action.hover};
        color: ${theme.colors.text.primary};
      }
    `,
    selected: css`
      color: ${theme.colors.text.primary};
      background: ${theme.colors.action.selected};

      &:hover {
        background: ${theme.colors.action.focus};
      }
    `,
    icon: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
};
