import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

/** The frame around one insight in the pane, so each reads like the Insight panel it mirrors. */
export function InsightCard({ children }: { children: ReactNode }) {
  const styles = useStyles2(getStyles);
  return <div className={styles.card}>{children}</div>;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
    }),
  };
}
