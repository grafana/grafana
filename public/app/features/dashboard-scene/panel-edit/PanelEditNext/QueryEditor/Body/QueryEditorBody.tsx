import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { useQueryEditorUIContext } from '../QueryEditorContext';

import { QueryEditorDetailsSidebar } from './QueryEditorDetailsSidebar';

interface QueryEditorBodyProps {
  children?: ReactNode;
}

export function QueryEditorBody({ children }: QueryEditorBodyProps) {
  const styles = useStyles2(getStyles);
  const { queryOptions } = useQueryEditorUIContext();
  const { isSidebarOpen } = queryOptions;

  return (
    <div className={styles.container}>
      <div className={styles.content}>{children}</div>
      {isSidebarOpen && (
        <div className={styles.sidebarWrapper}>
          <QueryEditorDetailsSidebar />
        </div>
      )}
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
