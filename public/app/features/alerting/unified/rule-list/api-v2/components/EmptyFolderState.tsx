import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  title?: string;
  message?: string;
}

export function EmptyFolderState({ title = 'No rules', message = 'No rules match the current filters.' }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      padding: theme.spacing(4, 2),
      textAlign: 'center',
      color: theme.colors.text.secondary,
    }),
    title: css({
      margin: 0,
      marginBottom: theme.spacing(1),
      fontSize: theme.typography.h4.fontSize,
      color: theme.colors.text.primary,
    }),
    message: css({
      margin: 0,
    }),
  };
}
