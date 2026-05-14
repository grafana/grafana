import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { ResultsTable } from './ResultsTable';
import { DEFAULT_SQL, SqlEditor } from './SqlEditor';
import { SourcesPanel } from './SourcesPanel';
import { SummaryPanel } from './SummaryPanel';

interface Props {
  initialSql?: string;
}

export function SqlEditorMode({ initialSql }: Props = {}) {
  const styles = useStyles2(getStyles);
  const [sql, setSql] = useState(initialSql ?? DEFAULT_SQL);
  const [runKey, setRunKey] = useState(0);

  const handleTableClick = (tableName: string) => {
    const fromRegex = /\bFROM\s+\S+/i;
    if (fromRegex.test(sql)) {
      setSql(sql.replace(fromRegex, `FROM ${tableName}`));
    } else {
      setSql(sql + `\nFROM ${tableName}`);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.sources}>
        <SourcesPanel onTableClick={handleTableClick} />
      </div>

      <div className={styles.center}>
        <div className={styles.editorPane}>
          <SqlEditor
            value={sql}
            onChange={setSql}
            onRunQuery={() => setRunKey((k) => k + 1)}
            height="100%"
          />
        </div>
        <div className={styles.resultsPane}>
          <ResultsTable key={runKey} sql={sql} />
        </div>
      </div>

      <div className={styles.summary}>
        <SummaryPanel sql={sql} />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'grid',
      gridTemplateColumns: '220px 1fr 300px',
      gridTemplateRows: '1fr',
      height: '100%',
      overflow: 'hidden',
    }),
    sources: css({ gridColumn: 1, overflow: 'hidden' }),
    center: css({
      gridColumn: 2,
      display: 'grid',
      gridTemplateRows: '1fr 280px',
      overflow: 'hidden',
    }),
    editorPane: css({ overflow: 'hidden', display: 'flex', flexDirection: 'column' }),
    resultsPane: css({ overflow: 'hidden', display: 'flex', flexDirection: 'column' }),
    summary: css({ gridColumn: 3, overflow: 'hidden' }),
  };
}
