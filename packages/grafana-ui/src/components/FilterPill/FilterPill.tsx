import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types/icon';
import { clearButtonStyles } from '../Button/Button';
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
      {selected && <Icon name={icon} className={styles.icon} data-testid="filter-pill-icon" />}
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.pill,
      padding: theme.spacing(0, 2),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
      height: '32px',
      position: 'relative',
      border: `1px solid ${theme.colors.background.secondary}`,
      whiteSpace: 'nowrap',

      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
    }),
    selected: css({
      color: theme.colors.text.primary,
      background: theme.colors.action.selected,

      '&:hover': {
        background: theme.colors.action.focus,
      },
    }),
    icon: css({
      marginLeft: theme.spacing(0.5),
    }),
  };
};
