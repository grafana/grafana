import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Input, Modal, Spinner, Tab, TabContent, TabsBar, Text, useStyles2 } from '@grafana/ui';

import { askAiStream } from '../mocks/mockAi';
import { DEFAULT_SQL } from '../editor/SqlEditor';

import { MockViz } from './MockViz';

type VizType = 'timeseries' | 'barchart' | 'stat' | 'bargauge';

interface GeneratedResult {
  prompt: string;
  sql: string;
  vizType: VizType;
}

interface Props {
  onEditInSqlEditor?: (sql: string) => void;
  onInserted?: () => void;
}

// Canned PromQL equivalent for each generated SQL output
const PROMQL_FOR_VIZ: Record<VizType, string> = {
  timeseries: `histogram_quantile(0.95,
  sum by (le, path) (
    rate(http_server_requests_seconds_bucket[5m])
  )
)`,
  barchart: `sum by (path, method) (
  rate(http_server_requests_seconds_count{
    status=~"5.."
  }[5m])
)
/
sum by (path, method) (
  rate(http_server_requests_seconds_count[5m])
)`,
  bargauge: `topk(5,
  sum by (path) (
    rate(http_server_requests_seconds_count[5m])
  )
)`,
  stat: `histogram_quantile(0.50,
  sum by (le) (
    rate(http_server_requests_seconds_bucket[5m])
  )
)`,
};

export function AiPanel({ onEditInSqlEditor, onInserted }: Props) {
  const styles = useStyles2(getStyles);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'preview'>('idle');
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [activeTab, setActiveTab] = useState<'sql' | 'promql'>('sql');
  const [inserted, setInserted] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) {
      return;
    }
    const prompt = input.trim();
    setPhase('loading');

    let responseText = '';
    const gen = askAiStream({ kind: 'generate-panel', payload: prompt });
    for await (const chunk of gen) {
      responseText += chunk;
    }

    try {
      const parsed = JSON.parse(responseText) as { sql: string; vizType: VizType };
      setResult({ prompt, sql: parsed.sql, vizType: parsed.vizType });
    } catch {
      setResult({ prompt, sql: DEFAULT_SQL, vizType: 'timeseries' });
    }
    setPhase('preview');
  };

  const handleInsert = () => {
    setPhase('idle');
    setInserted(true);
    onInserted?.();
  };

  const handleOpenInSqlEditor = () => {
    setPhase('idle');
    if (result) {
      onEditInSqlEditor?.(result.sql);
    }
  };

  // After insertion the tile shows the chart inline
  if (inserted && result) {
    return (
      <div className={styles.insertedRoot}>
        <MockViz title={result.prompt} height={180} />
      </div>
    );
  }

  return (
    <>
      {/* Idle state — prompt input with sparkline background */}
      <div className={styles.idleRoot}>
        <SparklineBg />
        <div className={styles.promptWrap}>
          <Input
            prefix={<span className={styles.sparkle}>✨</span>}
            placeholder="What do you want to learn?"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            disabled={phase === 'loading'}
            className={styles.promptInput}
          />
          {phase === 'loading' && (
            <div className={styles.loadingRow}>
              <Spinner size="sm" />
              <Text variant="bodySmall" color="secondary">Generating…</Text>
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {phase === 'preview' && result && (
        <Modal
          title={
            <div className={styles.modalTitle}>
              <span className={styles.sparkle}>✨</span>
              <span>What do you want to learn?</span>
            </div>
          }
          isOpen
          onDismiss={() => setPhase('idle')}
          contentClassName={styles.modalContent}
        >
          <div className={styles.promptChip}>
            <Text variant="bodySmall" color="secondary">Your question: </Text>
            <Text variant="bodySmall" weight="medium">&ldquo;{result.prompt}&rdquo;</Text>
          </div>

          {/* SQL / PromQL tabs */}
          <TabsBar>
            <Tab
              label="SQL"
              active={activeTab === 'sql'}
              onChangeTab={() => setActiveTab('sql')}
            />
            <Tab
              label="PromQL"
              active={activeTab === 'promql'}
              onChangeTab={() => setActiveTab('promql')}
            />
          </TabsBar>
          <TabContent>
            <pre className={styles.codeBlock}>
              {activeTab === 'sql' ? result.sql : PROMQL_FOR_VIZ[result.vizType]}
            </pre>
          </TabContent>

          {/* Chart preview */}
          <div className={styles.chartSection}>
            <Text variant="bodySmall" color="secondary" weight="bold">
              Suggested visualization
            </Text>
            <div className={styles.chartWrap}>
              <MockViz title={result.prompt} height={200} />
            </div>
          </div>

          {/* CTAs */}
          <div className={styles.actions}>
            <Button variant="primary" icon="plus" onClick={handleInsert}>
              Add to dashboard
            </Button>
            <Button variant="secondary" icon="pen" onClick={handleOpenInSqlEditor}>
              Open in SQL workbench
            </Button>
            <Button variant="secondary" fill="text" onClick={() => setPhase('idle')}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function SparklineBg() {
  const styles = useStyles2(getBgStyles);
  const W = 400, H = 120;
  const pts = Array.from({ length: 40 }, (_, i) => ({
    x: (i / 39) * W,
    y: H * 0.5 + Math.sin(i * 0.4) * H * 0.3 + (Math.sin(i * 1.3) - 0.5) * H * 0.08,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
    </svg>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    idleRoot: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    }),
    promptWrap: css({
      position: 'relative',
      zIndex: 1,
      width: '80%',
      maxWidth: 380,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      alignItems: 'center',
    }),
    promptInput: css({
      background: `rgba(${theme.isDark ? '0,0,0' : '255,255,255'},0.7)`,
      backdropFilter: 'blur(4px)',
    }),
    loadingRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    sparkle: css({ fontSize: '16px' }),
    insertedRoot: css({
      height: '100%',
      width: '100%',
    }),
    // Modal styles
    modalTitle: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    modalContent: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    promptChip: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.75, 1.25),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.pill,
      alignSelf: 'flex-start',
      alignItems: 'center',
    }),
    codeBlock: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1.5),
      margin: 0,
      whiteSpace: 'pre-wrap',
      color: theme.colors.text.primary,
      maxHeight: 180,
      overflowY: 'auto',
    }),
    chartSection: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    chartWrap: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      background: theme.colors.background.primary,
    }),
    actions: css({
      display: 'flex',
      gap: theme.spacing(1),
      paddingTop: theme.spacing(1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      flexWrap: 'wrap',
    }),
  };
}

function getBgStyles(theme: GrafanaTheme2) {
  return {
    svg: css({
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      color: theme.colors.primary.text,
      pointerEvents: 'none',
    }),
  };
}
