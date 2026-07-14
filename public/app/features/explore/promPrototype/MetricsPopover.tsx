// Prototype-only. Not internationalized.
// Floating popover for Option B — a discovery UI that mixes Option A's tree
// browser with autocomplete-style filtering. Trigger: focus the PromQL editor.
// Content morphs with editor state:
//
//   - Empty editor              → starter queries + "Browse metrics & labels"
//   - Typing a metric name      → filtered metric list based on what's being typed
//   - "Browse" clicked          → full metric tree with its own search input
//
// Pin button in the header docks this into the Option A layout for the session.

import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, IconButton, useStyles2 } from '@grafana/ui';

import { MetricTree } from './MetricTree';
import { usePromPrototype } from './PromPrototypeContext';
import {
  findPromqlEditorDomNode,
  getEditorSnapshot,
  insertAtCursorWithNewCursor,
  replaceEditorText,
  subscribeToEditor,
  subscribeToEditorFocus,
} from './promEditorBridge';
import { type MockMetric } from './prometheusMockCatalog';
import {
  currentIdentifierAtCursor,
  insertLabelAbsence,
  insertLabelPresence,
  insertLabelValueAtCursor,
  insertLabelValueExclusion,
  insertMetric,
  isAmbiguous,
} from './promqlInsertion';

const STARTER_QUERIES: Array<{ label: string; expr: string; description: string }> = [
  {
    label: 'HTTP p95 latency',
    expr: 'histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket[5m])) by (le))',
    description: 'A common latency query using a histogram metric',
  },
  {
    label: 'Instance CPU usage',
    expr: 'rate(node_cpu_seconds_total{mode!="idle"}[5m])',
    description: 'Per-mode CPU utilization across instances',
  },
  {
    label: 'Currently up',
    expr: 'up == 1',
    description: 'Every target that is currently scraping successfully',
  },
];

// Poll for the promql editor DOM element so we can anchor the popover to it.
// Falls back to a centered viewport position if the editor is not mounted yet,
// so the popover is still discoverable during a demo.
function usePromqlEditorRect(active: boolean): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) {
        return;
      }
      const promEditor = findPromqlEditorDomNode();
      if (promEditor) {
        const r = promEditor.getBoundingClientRect();
        if (r.width > 0) {
          setRect(r);
        }
      } else {
        const fallback = new DOMRect(window.innerWidth / 2 - 200, 120, 400, 40);
        setRect(fallback);
      }
      window.setTimeout(tick, 500);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [active]);
  return rect;
}

export function MetricsPopover() {
  const styles = useStyles2(getStyles);
  const { option, pinToRail, pinnedInSession } = usePromPrototype();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [browseFilter, setBrowseFilter] = useState('');
  const [editorText, setEditorText] = useState('');
  const [editorCursor, setEditorCursor] = useState(0);
  // If the user explicitly dismissed the popover, don't re-show until they focus the editor again.
  const dismissedRef = useRef(false);

  const active = option === 'b' && !pinnedInSession;
  const rect = usePromqlEditorRect(active);

  // Editor content subscription (drives the "typing" content mode).
  useEffect(() => {
    if (!active) {
      return;
    }
    return subscribeToEditor((snap) => {
      setEditorText(snap.text);
      setEditorCursor(snap.cursor);
    });
  }, [active]);

  // Focus subscription — this is the primary trigger for showing the popover.
  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    // eslint-disable-next-line no-console
    console.info('[prom-prototype] Option B: subscribing to editor focus');
    return subscribeToEditorFocus((focused) => {
      // eslint-disable-next-line no-console
      console.debug('[prom-prototype] editor focus:', focused);
      if (focused) {
        // Focus resets the "dismissed" state — user is explicitly re-engaging.
        dismissedRef.current = false;
        setVisible(true);
      }
      // Deliberately do NOT hide on blur; the user often needs to move mouse
      // into the popover to click things. Explicit dismiss / pin / clicking
      // outside handles hiding.
    });
  }, [active]);

  // Click-outside to dismiss (but not clicks inside the editor or the popover itself).
  const popoverRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!visible) {
      return;
    }
    const handler = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) {
        return;
      }
      if (popoverRef.current?.contains(target)) {
        return;
      }
      const editorEl = findPromqlEditorDomNode();
      if (editorEl?.contains(target)) {
        return;
      }
      dismissedRef.current = true;
      setVisible(false);
      setExpanded(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  if (!active || !visible || !rect) {
    return null;
  }

  const dismiss = () => {
    dismissedRef.current = true;
    setVisible(false);
    setExpanded(false);
  };

  const insertStarter = (expr: string) => {
    replaceEditorText(expr);
    dismiss();
  };

  // Click on a metric name → keep popover open, don't insert; user needs the +
  // button to add it. Matches Option A's tree behavior.
  const handleMetricClick = (_metric: MockMetric) => {
    // no-op — MetricTree handles expanding labels internally
  };

  const handleMetricAdd = (metric: MockMetric, _anchor: DOMRect) => {
    const snap = getEditorSnapshot() ?? { text: '', cursor: 0 };
    const result = insertMetric(metric.name, snap);
    if (!isAmbiguous(result)) {
      insertAtCursorWithNewCursor(result.text, result.cursor);
    }
  };

  const handleLabelAdd = (_metric: MockMetric, label: string, _anchor: DOMRect) => {
    const snap = getEditorSnapshot() ?? { text: '', cursor: 0 };
    const result = insertLabelPresence(label, snap);
    if (!isAmbiguous(result)) {
      insertAtCursorWithNewCursor(result.text, result.cursor);
    }
  };

  const handleLabelExclude = (_metric: MockMetric, label: string, _anchor: DOMRect) => {
    const snap = getEditorSnapshot() ?? { text: '', cursor: 0 };
    const result = insertLabelAbsence(label, snap);
    if (!isAmbiguous(result)) {
      insertAtCursorWithNewCursor(result.text, result.cursor);
    }
  };

  const handleValueAdd = (_metric: MockMetric, label: string, value: string, _anchor: DOMRect) => {
    const snap = getEditorSnapshot() ?? { text: '', cursor: 0 };
    const result = insertLabelValueAtCursor(label, value, snap);
    if (!isAmbiguous(result)) {
      insertAtCursorWithNewCursor(result.text, result.cursor);
    }
  };

  const handleValueExclude = (_metric: MockMetric, label: string, value: string, _anchor: DOMRect) => {
    const snap = getEditorSnapshot() ?? { text: '', cursor: 0 };
    const result = insertLabelValueExclusion(label, value, snap);
    if (!isAmbiguous(result)) {
      insertAtCursorWithNewCursor(result.text, result.cursor);
    }
  };

  // Decide what to show inside the popover body.
  const trimmed = editorText.trim();
  const isEmpty = trimmed.length === 0;
  const identAtCursor = currentIdentifierAtCursor(editorText, editorCursor);
  const typingFilter = identAtCursor.length >= 1 ? identAtCursor : trimmed;

  let mode: 'starters' | 'typing' | 'browse';
  if (expanded) {
    mode = 'browse';
  } else if (isEmpty) {
    mode = 'starters';
  } else {
    mode = 'typing';
  }

  const style: React.CSSProperties = {
    top: rect.top + rect.height + 6,
    left: rect.left + 16,
    width: mode === 'browse' ? 520 : mode === 'typing' ? 440 : 380,
  };

  return createPortal(
    <div ref={popoverRef} className={styles.popover} style={style} role="dialog" aria-label="Prometheus quickstart">
      <div className={styles.header}>
        <div className={styles.title}>
          <Icon name={mode === 'browse' ? 'list-ul' : 'search'} />
          <span>
            {mode === 'starters' && 'Quickstart'}
            {mode === 'typing' && (
              <>
                Matching <code className={styles.headerCode}>{typingFilter}</code>
              </>
            )}
            {mode === 'browse' && 'Browse metrics'}
          </span>
        </div>
        <div className={styles.headerActions}>
          {mode === 'typing' && (
            <IconButton
              name="list-ul"
              aria-label="Browse all"
              tooltip="Browse all metrics"
              onClick={() => setExpanded(true)}
            />
          )}
          {mode === 'browse' && (
            <IconButton name="arrow-left" aria-label="Back" tooltip="Back" onClick={() => setExpanded(false)} />
          )}
          {mode === 'browse' && (
            <IconButton
              name="gf-pin"
              aria-label="Pin to rail"
              tooltip="Pin as persistent rail"
              onClick={() => {
                pinToRail();
                dismiss();
              }}
            />
          )}
          <IconButton name="times" aria-label="Dismiss" onClick={dismiss} />
        </div>
      </div>

      {mode === 'starters' && (
        <>
          <div className={styles.starterList}>
            {STARTER_QUERIES.map((s) => (
              <button key={s.expr} className={styles.starterCard} onClick={() => insertStarter(s.expr)}>
                <div className={styles.starterHeader}>
                  <Icon name="arrow-right" />
                  <span className={styles.starterLabel}>{s.label}</span>
                </div>
                <code className={styles.starterExpr}>{s.expr}</code>
                <span className={styles.starterDesc}>{s.description}</span>
              </button>
            ))}
          </div>
          <div className={styles.divider} />
          <div className={styles.browseButtonRow}>
            <Button variant="primary" fill="solid" icon="list-ul" onClick={() => setExpanded(true)}>
              Browse metrics &amp; labels
            </Button>
          </div>
        </>
      )}

      {mode === 'typing' && (
        <div className={styles.typingBody}>
          <MetricTree
            filter={typingFilter}
            onFilterChange={() => {}}
            hideSearch
            onMetricClick={handleMetricClick}
            onMetricAdd={handleMetricAdd}
            onLabelAdd={handleLabelAdd}
            onLabelExclude={handleLabelExclude}
            onValueAdd={handleValueAdd}
            onValueExclude={handleValueExclude}
          />
        </div>
      )}

      {mode === 'browse' && (
        <div className={styles.treeWrap}>
          <MetricTree
            filter={browseFilter}
            onFilterChange={setBrowseFilter}
            onMetricClick={handleMetricClick}
            onMetricAdd={handleMetricAdd}
            onLabelAdd={handleLabelAdd}
            onLabelExclude={handleLabelExclude}
            onValueAdd={handleValueAdd}
            onValueExclude={handleValueExclude}
          />
        </div>
      )}
    </div>,
    document.body
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    position: 'fixed',
    zIndex: theme.zIndex.modal,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '65vh',
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
    gap: theme.spacing(1),
  }),
  title: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    fontWeight: theme.typography.fontWeightMedium,
    minWidth: 0,
    overflow: 'hidden',
  }),
  headerCode: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.size.sm,
    color: theme.colors.primary.text,
    background: theme.colors.background.primary,
    padding: theme.spacing(0, 0.5),
    borderRadius: theme.shape.radius.default,
    marginLeft: theme.spacing(0.5),
  }),
  headerActions: css({
    display: 'flex',
    gap: theme.spacing(0.5),
    flexShrink: 0,
  }),
  starterList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.5),
  }),
  starterCard: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    padding: theme.spacing(1),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    textAlign: 'left',
    '&:hover': {
      borderColor: theme.colors.primary.border,
      background: theme.colors.action.hover,
    },
  }),
  starterHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.primary.text,
  }),
  starterLabel: css({
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  starterExpr: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.size.xs,
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  starterDesc: css({
    fontSize: theme.typography.size.xs,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(0.25),
  }),
  browseButtonRow: css({
    display: 'flex',
    justifyContent: 'flex-start',
    padding: theme.spacing(1, 1.5),
  }),
  divider: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  typingBody: css({
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    maxHeight: '45vh',
    padding: theme.spacing(0.5),
  }),
  treeWrap: css({
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '55vh',
    padding: theme.spacing(1),
  }),
});
