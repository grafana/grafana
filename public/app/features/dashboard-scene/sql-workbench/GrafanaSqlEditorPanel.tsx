import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { GrafanaSqlEditorFooter } from './GrafanaSqlEditorFooter';
import { GrafanaSqlEditorHeader } from './GrafanaSqlEditorHeader';
import { SqlEditor } from './SqlEditor';

interface Props {
  sql: string;
  onChange: (sql: string) => void;
  onBack: () => void;
}

export function GrafanaSqlEditorPanel({ sql, onChange, onBack }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.panel}>
      <GrafanaSqlEditorHeader queryName="A" onBack={onBack} />
      <div className={styles.editorWrap}>
        <SqlEditor value={sql} onChange={onChange} height="100%" />
      </div>
      <GrafanaSqlEditorFooter />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: '#181b1f',
      border: '1px solid rgba(204,204,220,0.12)',
      borderRadius: 6,
    }),
    editorWrap: css({
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      margin: '8px',
      border: '1px solid rgba(204,204,220,0.2)',
      borderRadius: 6,
    }),
  };
}
