import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

interface SidebarDividerProps {
  text: string;
}

export function SidebarDivider({ text }: SidebarDividerProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.divider}>
      <div className={styles.dividerLine} />
      <Text variant="bodySmall" color="secondary">
        {text}
      </Text>
      <div className={styles.dividerLine} />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    divider: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      width: '100%',
    }),
    dividerLine: css({
      flex: 1,
      height: 1,
      background: theme.colors.border.weak,
    }),
  };
}
