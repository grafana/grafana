import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Legend, useStyles2 } from '@grafana/ui';

export function VariableLegend({ className, ...rest }: Parameters<typeof Legend>['0']) {
  const styles = useStyles2(getStyles);
  return <Legend {...rest} className={cx(styles.legend, className)} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    legend: css({
      marginTop: theme.spacing(3),
      marginBottom: theme.spacing(1),
    }),
  };
}
