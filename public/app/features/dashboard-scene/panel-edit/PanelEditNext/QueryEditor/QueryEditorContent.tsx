import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { ContentHeader } from './Header/ContentHeader';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <ContentHeader />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    height: '100%',
    width: '100%',
  }),
});
