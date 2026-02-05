import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { QueryEditorBody } from './Body/QueryEditorBody';
import { QueryEditorFooter } from './Footer/QueryEditorFooter';
import { ContentHeader } from './Header/ContentHeader';
import { useQueryEditorUIContext } from './QueryEditorContext';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);
  const { queryOptions } = useQueryEditorUIContext();
  const { isSidebarOpen } = queryOptions;

  return (
    <div className={styles.container}>
      <ContentHeader />
      <QueryEditorBody>{/* Body content will be added here */}</QueryEditorBody>
      {!isSidebarOpen && <QueryEditorFooter />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    height: '100%',
    width: '100%',
  }),
});
