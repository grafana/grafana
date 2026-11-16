import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { QueryOptionsOverlay } from '../QueryOptionsOverlay';

export function QueryEditorBody({ children }: { children: ReactNode }) {
  const styles = useStyles2(getStyles);

  return (
    <QueryOptionsOverlay>
      <div className={styles.scrollableContent}>{children}</div>
    </QueryOptionsOverlay>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  scrollableContent: css({
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: theme.spacing(2),
  }),
});
