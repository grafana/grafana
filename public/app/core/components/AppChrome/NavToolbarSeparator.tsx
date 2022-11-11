import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  leftActionsSeparator?: boolean;
}

export function NavToolbarSeparator({ leftActionsSeparator }: Props) {
  const styles = useStyles2(getStyles);

  if (leftActionsSeparator) {
    return <div className={styles.leftActionsSeparator} />;
  }

  if (config.featureToggles.topnav) {
    return <div className={styles.line} />;
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    leftActionsSeparator: css({
      display: 'flex',
      flexGrow: 1,
    }),
    line: css({
      width: 1,
      backgroundColor: theme.colors.border.medium,
      height: 24,
    }),
  };
};
