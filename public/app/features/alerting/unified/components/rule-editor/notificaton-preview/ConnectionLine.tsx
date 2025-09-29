import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, useStyles2 } from '@grafana/ui';

export function ConnectionLine() {
  const styles = useStyles2(getStyles);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" height={4}>
      <div className={styles.line} />
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  line: css({
    width: '1px',
    height: '100%',
    background: theme.colors.border.medium,
  }),
});
