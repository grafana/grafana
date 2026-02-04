import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface QueryEditorBodyProps {
  children?: ReactNode;
  sidebar?: ReactNode;
}

export function QueryEditorBody({ children, sidebar }: QueryEditorBodyProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.content}>{children}</div>
      {sidebar && <div className={styles.sidebarWrapper}>{sidebar}</div>}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }),
    sidebarWrapper: css({
      flexShrink: 0,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
    content: css({
      flex: 1,
      minWidth: 0,
      overflow: 'auto',
      padding: theme.spacing(2),
    }),
  };
}
