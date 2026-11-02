import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CardEditorRenderer } from '../CardEditorRenderer';
import { QueryOptionsOverlay } from '../QueryOptionsOverlay';

export function QueryEditorBody() {
  const styles = useStyles2(getStyles);

  return (
    <QueryOptionsOverlay>
      <div className={styles.scrollableContent}>
        <CardEditorRenderer />
      </div>
    </QueryOptionsOverlay>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  scrollableContent: css({
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: theme.spacing(2),
  }),
});
