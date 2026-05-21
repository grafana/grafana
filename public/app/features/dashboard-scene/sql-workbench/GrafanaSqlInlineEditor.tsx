import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type DataSourceInstanceSettings, type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { GRAFANA_SQL_DEFAULT_QUERY } from './GrafanaSqlMode';
import { setGrafanaSqlActiveLine, subscribeGrafanaSqlActiveLine } from './workbenchStore';
import { SqlEditor } from './SqlEditor';

interface Props {
  onChangeDatasource: (ds: DataSourceInstanceSettings) => void;
}

export function GrafanaSqlInlineEditor({ onChangeDatasource }: Props) {
  const styles = useStyles2(getStyles);
  const [sql, setSql] = useState(GRAFANA_SQL_DEFAULT_QUERY);
  const setCursorLineRef = useRef<((line: number) => void) | null>(null);

  // Card → editor: when a card item is clicked, move the cursor
  useEffect(() => {
    return subscribeGrafanaSqlActiveLine((line) => {
      if (line !== null) {
        setCursorLineRef.current?.(line);
      }
    });
  }, []);

  return (
    <div className={styles.editorArea}>
      <SqlEditor
        value={sql}
        onChange={setSql}
        height="100%"
        setCursorLineRef={setCursorLineRef}
        onCursorLineChange={(line) => setGrafanaSqlActiveLine(line)}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    editorArea: css({
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      margin: theme.spacing(0, 1, 1, 1),
      marginTop: 12,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
    }),
  };
}
