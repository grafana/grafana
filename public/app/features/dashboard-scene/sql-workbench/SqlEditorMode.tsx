import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDragStyles, useStyles2 } from '@grafana/ui';

import { ResultsTable } from './ResultsTable';
import { DEFAULT_SQL, SqlEditor } from './SqlEditor';
import { SourcesPanel } from './SourcesPanel';
import { SummaryPanel } from './SummaryPanel';
import { VizOptionsPanel } from './VizOptionsPanel';
import { consumePendingWorkbenchSql } from './workbenchStore';

type ViewMode = 'table' | 'viz';

interface Props {
  initialSql?: string;
}

export function SqlEditorMode({ initialSql }: Props = {}) {
  const styles = useStyles2(getStyles);
  const dragStyles = getDragStyles(config.theme2);
  const [sql, setSql] = useState(() => consumePendingWorkbenchSql() ?? initialSql ?? DEFAULT_SQL);
  const [runKey, setRunKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editorHeight, setEditorHeight] = useState(350);

  const handleTableClick = (tableName: string) => {
    const fromRegex = /\bFROM\s+\S+/i;
    if (fromRegex.test(sql)) {
      setSql(sql.replace(fromRegex, `FROM ${tableName}`));
    } else {
      setSql(sql + `\nFROM ${tableName}`);
    }
  };

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = editorHeight;

      const onMove = (ev: MouseEvent) => {
        setEditorHeight(Math.max(80, startH + ev.clientY - startY));
      };
      const onUp = () => {
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.body.style.cursor = 'row-resize';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [editorHeight]
  );

  return (
    <div className={styles.root}>
      <div className={styles.sources}>
        <SourcesPanel onTableClick={handleTableClick} />
      </div>

      <div className={styles.center}>
        <div className={styles.editorPane} style={{ height: editorHeight }}>
          <SqlEditor
            value={sql}
            onChange={setSql}
            onRunQuery={() => setRunKey((k) => k + 1)}
            height="100%"
          />
        </div>
        <div
          className={cx(styles.dragHandle, dragStyles.dragHandleHorizontal)}
          onMouseDown={handleDragStart}
          role="separator"
          aria-orientation="horizontal"
        />
        <div className={styles.resultsPane}>
          <ResultsTable
            key={runKey}
            sql={sql}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      <div className={styles.rightPanel}>
        {viewMode === 'viz' ? <VizOptionsPanel /> : <SummaryPanel sql={sql} />}
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
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }),
    editorPane: css({
      flexShrink: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }),
    dragHandle: css({ flexShrink: 0 }),
    resultsPane: css({
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }),
    rightPanel: css({ gridColumn: 3, overflow: 'hidden' }),
  };
}
