import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

/** Where an item dragged in from another list would be dropped. Rows take the list's width, tabs their own. */
export function ListDropPlaceholder({ height, width }: { height: number; width?: number }) {
  const styles = useStyles2(getStyles);
  return <div className={styles.placeholder} style={{ height, width }} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    placeholder: css({
      flexShrink: 0,
      borderRadius: theme.shape.radius.default,
      border: `1px dashed ${theme.colors.primary.border}`,
      background: theme.colors.primary.transparent,
    }),
  };
}
