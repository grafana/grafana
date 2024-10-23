import { css, cx } from '@emotion/css';
import * as React from 'react';

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
      <span className={styles.label}>{label}</span>
      {selected && <Icon name={icon} className={styles.icon} />}
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.pill,
      padding: theme.spacing(1, 2),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      minHeight: '32px',
      position: 'relative',
      border: `1px solid ${theme.colors.background.secondary}`,
      width: '100%',
      textAlign: 'left',

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
    label: css({
      wordBreak: 'break-word',
      marginRight: theme.spacing(1),
    }),
    icon: css({
      marginLeft: theme.spacing(0.5),
      alignSelf: 'center',
    }),
  };
};
