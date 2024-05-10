import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

export const getStyles = (theme: GrafanaTheme2) => ({
  ActionButton: css({
    label: 'ActionButton',
    overflow: 'hidden',
    position: 'relative',
    '&:after': {
      content: '""',
      background: theme.colors.primary.main,
      display: 'block',
      position: 'absolute',
      right: 0,
      width: '100%',
      height: '100%',
      opacity: 0,
      transition: 'all 0.8s',
    },
    '&:active:after': {
      margin: 0,
      opacity: 0.3,
      transition: '0s',
    },
  }),
});

export type ActionButtonProps = {
  onClick: () => void;
  ariaLabel: string;
  label: string;
  icon: IconName;
};

export default function ActionButton(props: ActionButtonProps) {
  const { onClick, ariaLabel, label, icon } = props;
  const styles = useStyles2(getStyles);

  return (
    <Button
      className={styles.ActionButton}
      size="sm"
      variant="secondary"
      fill={'outline'}
      type="button"
      icon={icon}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
