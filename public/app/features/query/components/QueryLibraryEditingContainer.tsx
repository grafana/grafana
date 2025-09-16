import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface QueryLibraryEditingContainerProps {
  children: ReactNode;
}

export function QueryLibraryEditingContainer({ children }: QueryLibraryEditingContainerProps) {
  const styles = useStyles2(getStyles);
  return <div className={styles.container}>{children}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    border: `2px solid ${theme.colors.primary.main}`,
    borderTopLeftRadius: 'unset',
    borderTopRightRadius: 'unset',
    borderBottomLeftRadius: theme.shape.radius.default,
    borderBottomRightRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
});
