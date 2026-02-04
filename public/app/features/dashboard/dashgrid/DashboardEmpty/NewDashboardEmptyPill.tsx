import { css, cx } from '@emotion/css';
import { MouseEventHandler } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { clearButtonStyles, Icon, useStyles2 } from '@grafana/ui';

export interface FilterPillProps {
  selected?: boolean;
  label: string;
  onClick?: MouseEventHandler<HTMLElement>;
}

export const NewDashboardEmptyPill = ({ label, selected = false, onClick }: FilterPillProps) => {
  const styles = useStyles2(getStyles);
  const clearButton = useStyles2(clearButtonStyles);
  return (
    <button type="button" className={cx(clearButton, styles.wrapper, selected && styles.selected)} onClick={onClick}>
      {selected && <Icon name="check" className={styles.icon} />}
      <span>{label}</span>
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.pill,
      padding: theme.spacing(1, 2),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
      border: `1px solid ${theme.colors.border.strong}`,

      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
    }),
    selected: css({
      color: theme.colors.text.primary,
      background: theme.colors.action.selected,
      borderColor: theme.colors.action.selectedBorder,

      '&:hover': {
        background: theme.colors.action.focus,
      },
    }),
    icon: css({
      marginRight: theme.spacing(0.5),
    }),
  };
};
