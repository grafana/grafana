import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';

import { useStyles2 } from '../../themes/ThemeContext';

export function MenuDivider() {
  const styles = useStyles2(getStyles);
  return <div className={styles.divider} />;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    divider: css({
      height: 1,
      backgroundColor: theme.colors.border.weak,
      margin: theme.spacing(1, 0),
    }),
  };
};
