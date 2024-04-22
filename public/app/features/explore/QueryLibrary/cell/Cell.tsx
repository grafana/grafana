import { css } from '@emotion/css';
import React, { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { useStyles2 } from '@grafana/ui/';

export function Cell(props: PropsWithChildren) {
  const styles = useStyles2(getStyles);
  return <div className={styles.cell}>{props.children}</div>;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    cell: css({
      background: theme.colors.background.secondary,
    }),
  };
}
