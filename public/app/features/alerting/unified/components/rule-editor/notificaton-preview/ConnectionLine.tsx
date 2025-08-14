import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export function ConnectionLine() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.line} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: theme.spacing(4),
  }),
  line: css({
    width: '1px',
    height: '100%',
    background: theme.colors.border.medium,
    borderRadius: '1px',
  }),
});
