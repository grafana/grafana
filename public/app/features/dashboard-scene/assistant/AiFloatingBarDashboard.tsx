import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Modal, Spinner, Tab, TabContent, TabsBar, Text, useStyles2 } from '@grafana/ui';

import { askAiStream, DEFAULT_SQL } from './mockAi';

type VizType = 'timeseries' | 'barchart' | 'stat' | 'bargauge';

interface GeneratedResult {
  prompt: string;
  sql: string;
  vizType: VizType;
}

interface SelectedPanel {
  title: string;
  sectionEl: HTMLElement;
}

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

export function AiFloatingBarDashboard() {
  const styles = useStyles2(getStyles);
  const [isHovered, setIsHovered] = useState(false);
  const [isSelectingPanel, setIsSelectingPanel] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(null);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'preview'>('idle');
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [activeTab, setActiveTab] = useState<'sql' | 'promql'>('sql');

  const expanded =
    isHovered || isSelectingPanel || selectedPanel !== null || input.length > 0 || phase !== 'idle';

  // Capture document clicks when in panel selection mode
  useEffect(() => {
    if (!isSelectingPanel) {
      return;
    }

    document.body.style.cursor = 'crosshair';

    const handleCapture = (e: MouseEvent) => {
      const target = e.target as Element;

      if (target.closest('[data-ai-floating-bar]')) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      const section = target.closest<HTMLElement>('section[class*="panel-container"]');
      if (!section) {
        setIsSelectingPanel(false);
        return;
      }

      const titleEl = section.querySelector('h6') ?? section.querySelector('[class*="title"]');
      const title = titleEl?.textContent?.trim() ?? 'Selected panel';

      setSelectedPanel({ title, sectionEl: section });
      setIsSelectingPanel(false);
    };

    document.addEventListener('click', handleCapture, true);

    return () => {
      document.removeEventListener('click', handleCapture, true);
      document.body.style.cursor = '';
    };
  }, [isSelectingPanel]);

  // Apply/remove blue border on the selected panel element
  useEffect(() => {
    const el = selectedPanel?.sectionEl;
    if (!el) {
      return;
    }
    const prev = { outline: el.style.outline, outlineOffset: el.style.outlineOffset };
    el.style.outline = '2px solid #6e9fff';
    el.style.outlineOffset = '2px';
    return () => {
      el.style.outline = prev.outline;
      el.style.outlineOffset = prev.outlineOffset;
    };
  }, [selectedPanel]);

  const handleSubmit = async () => {
    if (!input.trim() || isSelectingPanel) {
      return;
    }
    const promptText = selectedPanel ? `${selectedPanel.title}: ${input.trim()}` : input.trim();
    setPhase('loading');

    let responseText = '';
    const gen = askAiStream({ kind: 'generate-panel', payload: input.trim() });
    for await (const chunk of gen) {
      responseText += chunk;
    }

    try {
      const parsed = JSON.parse(responseText) as { sql: string; vizType: VizType };
      setResult({ prompt: promptText, sql: parsed.sql, vizType: parsed.vizType });
    } catch {
      setResult({ prompt: promptText, sql: DEFAULT_SQL, vizType: 'timeseries' });
    }
    setPhase('preview');
  };

  const handleDismissModal = () => {
    setPhase('idle');
    setInput('');
    setResult(null);
    setSelectedPanel(null);
  };

  const panelLabel =
    selectedPanel
      ? selectedPanel.title.length > 24
        ? selectedPanel.title.slice(0, 24) + '…'
        : selectedPanel.title
      : null;

  return (
    <>
      <div
        data-ai-floating-bar
        className={cx(styles.bar, expanded && styles.barExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Collapsed: AI sparkle icon */}
        {!expanded && (
          <Icon name="ai-sparkle" size="sm" className={styles.collapsedIcon} />
        )}

        {/* Expanded content */}
        {expanded && (
          <>
            {/* Select panel chip — or spinner while loading */}
            {phase === 'loading' ? (
              <div className={styles.selectChip}>
                <Spinner size="sm" />
              </div>
            ) : selectedPanel ? (
              /* Panel badge (Figma: info color scheme, rounded-2px) */
              <button className={styles.panelBadge} onClick={handleDismissModal}>
                <Icon name="chart-line" size="xs" />
                <span className={styles.badgeLabel}>{panelLabel}</span>
                <Icon name="times" size="xs" />
              </button>
            ) : (
              /* "Select panel" chip (Figma: #ccccdc bg, #24292e text, rounded-12px) */
              <button
                className={cx(styles.selectChip, isSelectingPanel && styles.selectChipActive)}
                onClick={() => setIsSelectingPanel(true)}
              >
                <Icon name="crosshair" size="sm" />
                <span>Select panel</span>
              </button>
            )}

            {/* Prompt input / placeholder */}
            <input
              className={styles.promptInput}
              placeholder={isSelectingPanel ? 'Click a panel to select it…' : 'What would you like to know?'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={phase === 'loading' || isSelectingPanel}
            />
          </>
        )}
      </div>

      {/* Result modal */}
      {phase === 'preview' && result && (
        <Modal
          title={
            <div className={styles.modalTitle}>
              <Icon name="ai-sparkle" size="md" className={styles.collapsedIcon} />
              <span>AI-generated panel</span>
            </div>
          }
          ariaLabel="Generate panel with AI"
          isOpen
          onDismiss={handleDismissModal}
          contentClassName={styles.modalContent}
        >
          <div className={styles.promptChip}>
            <Text variant="bodySmall" color="secondary">
              Your question:{' '}
            </Text>
            <Text variant="bodySmall" weight="medium">
              &ldquo;{result.prompt}&rdquo;
            </Text>
          </div>

          <div className={styles.queryContainer}>
            <TabsBar className={styles.queryTabs}>
              <Tab label="SQL" active={activeTab === 'sql'} onChangeTab={() => setActiveTab('sql')} />
              <Tab label="PromQL" active={activeTab === 'promql'} onChangeTab={() => setActiveTab('promql')} />
            </TabsBar>
            <TabContent>
              <pre className={styles.codeBlock}>
                {activeTab === 'sql' ? result.sql : PROMQL_FOR_VIZ[result.vizType]}
              </pre>
            </TabContent>
          </div>

          <div className={styles.chartSection}>
            <Text variant="bodySmall" color="secondary" weight="bold">
              Suggested visualization
            </Text>
            <div className={styles.chartWrap}>
              <PreviewSparkline />
            </div>
          </div>

          <div className={styles.actions}>
            <Button variant="primary" icon="plus" onClick={handleDismissModal}>
              Add to dashboard
            </Button>
            <Button variant="secondary" fill="text" onClick={handleDismissModal}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function PreviewSparkline() {
  const styles = useStyles2(getSparklineStyles);
  const W = 600;
  const H = 160;
  const pts = Array.from({ length: 60 }, (_, i) => ({
    x: (i / 59) * W,
    y: H * 0.5 + Math.sin(i * 0.35) * H * 0.28 + Math.sin(i * 1.1) * H * 0.1,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${d} L${W},${H} L0,${H} Z`;
  return (
    <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="aiPreviewGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#aiPreviewGrad)" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function getStyles(theme: GrafanaTheme2) {
  // Figma design tokens
  const chipBg = theme.colors.text.primary;        // #ccccdc in dark theme
  const chipText = '#24292e';                       // Figma: text/maxContrast - black
  const infoText = theme.colors.info.text;          // #6e9fff
  const infoTransparent = 'rgba(56, 113, 220, 0.2)'; // Figma: info/transparent
  const pillBorderCollapsed = 'transparent';
  const pillBorderExpanded = 'rgba(204, 204, 220, 0.3)'; // Figma: border/Strong at 30%

  return {
    // ── Floating pill ──────────────────────────────────────────
    bar: css({
      position: 'absolute',
      bottom: theme.spacing(3),
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(3.4px)',
      // Collapsed: light semi-transparent gray (Figma: rgba(217,217,217,0.45))
      background: 'rgba(217, 217, 217, 0.45)',
      border: `1px solid ${pillBorderCollapsed}`,
      borderRadius: 32,
      padding: '4px 16px',
      height: 24,
      width: 130,
      overflow: 'hidden',
      transition: 'width 0.2s ease, height 0.2s ease, background 0.15s ease, border-color 0.15s ease, padding 0.15s ease',
      zIndex: 150,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      boxShadow: theme.shadows.z2,
      pointerEvents: 'all',
    }),

    barExpanded: css({
      // Expanded: dark translucent (Figma: rgba(17,18,23,0.8))
      background: 'rgba(17, 18, 23, 0.8)',
      border: `1px solid ${pillBorderExpanded}`,
      height: 44,
      width: 580,
      padding: '12px',
      cursor: 'default',
      gap: '10px',
      justifyContent: 'flex-start',
    }),

    // AI sparkle icon in collapsed state — Figma uses #FF9830 (visualization/orange)
    collapsedIcon: css({
      color: '#FF9830',
      flexShrink: 0,
    }),

    // ── "Select panel" chip (Figma: bg #ccccdc, text #24292e, rounded-12px, p-6px) ──
    selectChip: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: chipBg,
      color: chipText,
      border: 'none',
      borderRadius: 12,
      padding: '6px',
      cursor: 'pointer',
      flexShrink: 0,
      fontSize: theme.typography.bodySmall.fontSize, // 12px
      fontWeight: theme.typography.fontWeightRegular,
      lineHeight: '18px',
      letterSpacing: '0.018px',
      transition: 'opacity 0.15s',
      '&:hover': { opacity: 0.85 },
    }),

    selectChipActive: css({
      // Slightly tinted when in selection mode
      opacity: 0.7,
    }),

    // ── Panel badge (Figma: info color, border, rounded-2px) ──────────
    panelBadge: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: infoTransparent,
      color: infoText,
      border: `1px solid ${infoText}`,
      borderRadius: 2,
      padding: '1px 4px',
      cursor: 'pointer',
      flexShrink: 0,
      fontSize: theme.typography.bodySmall.fontSize, // 12px
      fontWeight: theme.typography.fontWeightRegular,
      lineHeight: '18px',
      letterSpacing: '0.018px',
      maxWidth: 200,
      transition: 'opacity 0.15s',
      '&:hover': { opacity: 0.8 },
    }),

    badgeLabel: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),

    // ── Prompt input (Figma: text/primary #ccccdc, 14px Medium) ──────
    promptInput: css({
      flex: 1,
      minWidth: 0,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      // Figma placeholder: text/primary at reduced opacity
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: theme.typography.fontWeightMedium, // Medium
      fontFamily: theme.typography.fontFamily,
      lineHeight: '22px',
      letterSpacing: '0.021px',
      '&::placeholder': {
        color: theme.colors.text.primary,
        opacity: 0.7,
        fontWeight: theme.typography.fontWeightMedium,
      },
      '&:disabled': {
        cursor: 'default',
      },
    }),

    // ── Modal ─────────────────────────────────────────────────────────
    modalTitle: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    modalContent: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      maxHeight: '72vh',
      overflowY: 'auto',
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
    queryContainer: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
    queryTabs: css({
      background: theme.colors.background.secondary,
      paddingLeft: theme.spacing(0.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    codeBlock: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      background: theme.colors.background.canvas,
      padding: theme.spacing(1.5),
      margin: 0,
      whiteSpace: 'pre-wrap',
      color: theme.colors.text.primary,
      minHeight: 200,
      maxHeight: 280,
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
      height: 160,
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

function getSparklineStyles(theme: GrafanaTheme2) {
  return {
    svg: css({
      width: '100%',
      height: '100%',
      color: theme.colors.primary.text,
    }),
  };
}
