import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CardEditorRenderer } from '../CardEditorRenderer';
import { useQueryEditorUIContext } from '../QueryEditorContext';

import { QueryEditorDetailsSidebar } from './QueryEditorDetailsSidebar';

export function QueryEditorBody() {
  const styles = useStyles2(getStyles);
  const { queryOptions } = useQueryEditorUIContext();

  return (
    <div className={styles.container}>
      <div className={styles.scrollableContent}>
        <CardEditorRenderer />
      </div>
      {queryOptions.isQueryOptionsOpen && <QueryEditorDetailsSidebar />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    flex: 1,
    minHeight: 0,
    display: 'flex',
  }),
  scrollableContent: css({
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
    padding: theme.spacing(2),
  }),
});
