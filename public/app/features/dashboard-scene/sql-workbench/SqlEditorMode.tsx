import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDragStyles, Icon, useStyles2 } from '@grafana/ui';

import { ResultsTable } from './ResultsTable';
import { githubSchema } from './schema';
import { SourcesPanel } from './SourcesPanel';
import { DEFAULT_SQL, SqlEditor } from './SqlEditor';
import { SummaryPanel } from './SummaryPanel';
import { VizOptionsPanel } from './VizOptionsPanel';
import { consumePendingWorkbenchSql } from './workbenchStore';

type ViewMode = 'table' | 'viz';
type ActiveTab = 'prometheus' | 'github';

const DEFAULT_GITHUB_SQL = `SELECT
  r.name                   AS repo,
  COUNT(pr.id)             AS open_prs,
  AVG(pr.review_comments)  AS avg_comments,
  MAX(pr.created_at)       AS latest_pr_date
FROM pull_requests pr
JOIN repositories r ON r.id = pr.repository_id
WHERE pr.state = 'open'
  AND pr.created_at >= NOW() - INTERVAL '30 days'
GROUP BY r.name
ORDER BY open_prs DESC
LIMIT 20`;

interface Props {
  initialSql?: string;
}

export function SqlEditorMode({ initialSql }: Props = {}) {
  const styles = useStyles2(getStyles);
  const dragStyles = getDragStyles(config.theme2);
  const [promSql, setPromSql] = useState(() => consumePendingWorkbenchSql() ?? initialSql ?? DEFAULT_SQL);
  const [githubSql, setGithubSql] = useState(DEFAULT_GITHUB_SQL);
  const [activeTab, setActiveTab] = useState<ActiveTab>('prometheus');
  const [runKey, setRunKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [editorHeight, setEditorHeight] = useState(350);

  const sql = activeTab === 'github' ? githubSql : promSql;
  const setSql = activeTab === 'github' ? setGithubSql : setPromSql;

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setRunKey((k) => k + 1);
  };

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
        <SourcesPanel
          onTableClick={handleTableClick}
          schema={activeTab === 'github' ? githubSchema : undefined}
        />
      </div>

      <div className={styles.center}>
        <div className={styles.editorPane} style={{ height: editorHeight }}>
          <div className={styles.tabStrip}>
            <button
              className={cx(styles.tab, activeTab === 'prometheus' && styles.tabActive)}
              onClick={() => handleTabChange('prometheus')}
            >
              <Icon name="chart-line" size="sm" />
              Prometheus
            </button>
            <button
              className={cx(styles.tab, activeTab === 'github' && styles.tabActive)}
              onClick={() => handleTabChange('github')}
            >
              <Icon name="github" size="sm" />
              GitHub
            </button>
          </div>
          <div className={styles.editorInner}>
            <SqlEditor value={sql} onChange={setSql} onRunQuery={() => setRunKey((k) => k + 1)} height="100%" />
          </div>
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
            datasource={activeTab}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      <div className={styles.rightPanel}>{viewMode === 'viz' ? <VizOptionsPanel /> : <SummaryPanel sql={sql} />}</div>
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
    tabStrip: css({
      display: 'flex',
      alignItems: 'stretch',
      height: 34,
      background: '#1a1d21',
      borderBottom: '1px solid rgba(204,204,220,0.1)',
      flexShrink: 0,
    }),
    tab: css({
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '0 16px',
      background: 'none',
      border: 'none',
      borderBottom: '2px solid transparent',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      color: 'rgba(204,204,220,0.55)',
      transition: 'color 0.15s, background 0.15s',
      '&:hover': {
        color: 'rgba(204,204,220,0.9)',
        background: 'rgba(255,255,255,0.04)',
      },
    }),
    tabActive: css({
      color: '#6e9fff',
      borderBottomColor: '#6e9fff',
      background: 'rgba(110,159,255,0.07)',
      '&:hover': {
        color: '#6e9fff',
        background: 'rgba(110,159,255,0.1)',
      },
    }),
    editorInner: css({
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
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
