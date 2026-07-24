import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { AI_PURPLE, FLOW3, type FlowLiteNode } from '../logic/flows';

type Tone = 'default' | 'green' | 'blue' | 'dashed';

interface NodeProps {
  category: string;
  tone?: Tone;
  highlight?: boolean;
  children?: React.ReactNode;
  annotation?: { title: string; detail: string };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const TONE_CLASS = {
  default: 'node_default',
  green: 'node_green',
  blue: 'node_blue',
  dashed: 'node_dashed',
} as const;

function Node({ category, tone = 'default', highlight, children, annotation, onMouseEnter, onMouseLeave }: NodeProps) {
  const styles = useStyles2(getStyles);
  return (
    <div
      className={cx(styles.node, styles[TONE_CLASS[tone]], highlight && styles.nodeHighlight)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.category}>{category}</div>
      {children && (
        <div className={cx(styles.value, tone === 'green' && styles.valueGreen, tone === 'blue' && styles.valueBlue)}>
          {children}
        </div>
      )}
      {annotation && (
        <div className={styles.annotation}>
          <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE }} />
          <span>
            <span className={styles.annTitle}>{annotation.title}:</span> {annotation.detail}
          </span>
        </div>
      )}
    </div>
  );
}

function Arrow() {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.arrow}>
      <span className={styles.dashes} />
      <Icon name="angle-right" size="sm" className={styles.chevron} />
    </span>
  );
}

// --- generic linear flow (Flow 2 chips) -----------------------------------
export function LinearFlow({ nodes }: { nodes: FlowLiteNode[] }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.row}>
      {nodes.map((n, i) => [
        <Node key={`n${i}`} category={n.category} tone={n.tone ?? 'default'}>
          {n.value}
        </Node>,
        i < nodes.length - 1 ? <Arrow key={`a${i}`} /> : null,
      ])}
    </div>
  );
}

// --- up/down (Flow 2) -----------------------------------------------------
export function UpDownFlow({ building }: { building: boolean }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.row}>
      <Node category="GAUGE">up</Node>
      <Arrow />
      {building ? (
        <Node category="METRIC LABEL" tone="dashed" />
      ) : (
        <Node category="METRIC LABEL" tone="green">
          service_name = &quot;checkout-service&quot;
        </Node>
      )}
    </div>
  );
}

// --- histogram / p95 (Flow 3) ---------------------------------------------
interface HistogramFlowProps {
  hovered: 'le' | 'hq' | null;
  onHover: (id: 'le' | 'hq' | null) => void;
}

export function HistogramFlow({ hovered, onHover }: HistogramFlowProps) {
  const styles = useStyles2(getStyles);
  // Annotations/highlights only appear on actual hover — nothing expanded by default.
  const showLe = hovered === 'le';
  const showHq = hovered === 'hq';

  return (
    <div className={styles.histogram}>
      <div className={styles.row}>
        <Node category="COUNTER">server_request_duration...</Node>
        <Arrow />
        <Node category="FUNCTION">rate 5m</Node>
        <span className={styles.trailing}>
          <span className={styles.dashes} />
        </span>
      </div>
      <div className={styles.row}>
        <Node
          category="FUNCTION"
          highlight={showLe}
          annotation={showLe ? FLOW3.suggestions.le : undefined}
          onMouseEnter={() => onHover('le')}
          onMouseLeave={() => onHover(null)}
        >
          sum by(path, <span className={styles.added}>le</span>)
        </Node>
        <Arrow />
        <Node
          category="FUNCTION"
          tone="blue"
          highlight={showHq}
          annotation={showHq ? FLOW3.suggestions.hq : undefined}
          onMouseEnter={() => onHover('hq')}
          onMouseLeave={() => onHover(null)}
        >
          histogram_quantile 0.95
        </Node>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(1), flexWrap: 'wrap' }),
  histogram: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }),
  node: css({
    background: theme.colors.background.secondary,
    borderRadius: 6,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1, 1.25),
    minWidth: 128,
  }),
  node_default: css({}),
  node_green: css({ border: `1px solid ${theme.colors.success.border}` }),
  node_blue: css({ border: `1px dashed ${theme.colors.primary.border}` }),
  node_dashed: css({ border: `1px dashed ${theme.colors.border.medium}`, minHeight: 44 }),
  nodeHighlight: css({
    boxShadow: `0 0 0 1px ${theme.colors.border.strong}`,
    background: theme.colors.background.canvas,
  }),
  category: css({
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  }),
  value: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
  }),
  valueGreen: css({ color: theme.colors.success.text }),
  valueBlue: css({ color: theme.colors.primary.text }),
  added: css({ color: theme.colors.success.text }),
  annotation: css({
    display: 'flex',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.5,
    maxWidth: 220,
  }),
  annTitle: css({ color: theme.colors.text.primary, fontStyle: 'italic' }),
  arrow: css({ display: 'inline-flex', alignItems: 'center', color: theme.colors.text.disabled }),
  dashes: css({
    width: 24,
    borderTop: `1px dashed ${theme.colors.border.strong}`,
    display: 'inline-block',
  }),
  chevron: css({ color: theme.colors.text.disabled, marginLeft: -4 }),
  trailing: css({ display: 'inline-flex', alignItems: 'center', opacity: 0.5 }),
});
