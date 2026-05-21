import { css } from '@emotion/css';
import { useState } from 'react';

import { type DataSourceInstanceSettings, type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { GRAFANA_SQL_DEFAULT_QUERY } from './GrafanaSqlMode';
import { GrafanaSqlEditorHeader } from './GrafanaSqlEditorHeader';
import { GrafanaSqlEditorFooter } from './GrafanaSqlEditorFooter';
import { SqlEditor } from './SqlEditor';

interface Props {
  onChangeDatasource: (ds: DataSourceInstanceSettings) => void;
}

export function GrafanaSqlInlineEditor({ onChangeDatasource }: Props) {
  const styles = useStyles2(getStyles);
  const [sql, setSql] = useState(GRAFANA_SQL_DEFAULT_QUERY);

  return (
    <div className={styles.root}>
      <GrafanaSqlEditorHeader queryName="A" onBack={() => {}} />
      <div className={styles.editorArea}>
        <SqlEditor value={sql} onChange={setSql} height="100%" />
      </div>
      <GrafanaSqlEditorFooter />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }),
    editorArea: css({
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      margin: theme.spacing(0, 1, 1, 1),
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
    }),
  };
}
