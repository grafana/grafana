// Prototype-only. Not internationalized.
// Overlay shown below the PromQL editor when the user focuses it and the
// current query is a bare counter metric name. Suggests wrapping the metric
// in rate(…[5m]) or increase(…[1h]). Portaled to document.body; anchored to
// the PromQL editor DOM node.

import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import {
  findPromqlEditorDomNode,
  replaceEditorText,
  subscribeToEditor,
  subscribeToEditorFocus,
} from './promEditorBridge';
import { isBareMetric } from './prometheusMockCatalog';

interface Suggestion {
  label: string;
  build: (metric: string) => string;
  // Broken into prefix / metric / suffix so we can highlight the metric name in
  // the preview.
  prefix: string;
  suffix: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: 'Spot spikes or trends',
    prefix: 'rate(',
    suffix: '[5m])',
    build: (metric) => `rate(${metric}[5m])`,
  },
  {
    label: 'Get a simple total',
    prefix: 'increase(',
    suffix: '[1h])',
    build: (metric) => `increase(${metric}[1h])`,
  },
];

export function CounterSuggestionsPopover() {
  const styles = useStyles2(getStyles);
  const [visible, setVisible] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [focused, setFocused] = useState(0);
  const dismissedForCurrentText = useRef<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    return subscribeToEditor((snap) => {
      setEditorText(snap.text);
      // Also surface the popover proactively when the editor content BECOMES a
      // bare counter (e.g. right after the user clicked `+` on a counter in the
      // tree). This avoids requiring an extra click into the editor to trigger it.
      const metric = isBareMetric(snap.text);
      if (metric && metric.type === 'counter' && dismissedForCurrentText.current !== snap.text) {
        setVisible(true);
        updateAnchor();
      }
    });
  }, []);

  useEffect(() => {
    return subscribeToEditorFocus((focusedNow) => {
      if (focusedNow) {
        // Re-arm on focus.
        dismissedForCurrentText.current = null;
        setVisible(true);
        updateAnchor();
      }
    });
  }, []);

  const updateAnchor = () => {
    const el = findPromqlEditorDomNode();
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0) {
        setAnchorRect(r);
      }
    }
  };

  // Keep the anchor rect fresh if the editor resizes / moves while visible.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const id = window.setInterval(updateAnchor, 500);
    return () => window.clearInterval(id);
  }, [visible]);

  const counterMetric = useMemo(() => {
    const m = isBareMetric(editorText);
    return m && m.type === 'counter' ? m : null;
  }, [editorText]);

  // Reset focus to the primary suggestion whenever the popover reopens.
  useEffect(() => {
    if (visible) {
      setFocused(0);
    }
  }, [visible, counterMetric?.name]);

  // Keyboard nav.
  useEffect(() => {
    if (!visible || !counterMetric) {
      return;
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        dismiss();
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        setFocused((i) => (i + 1) % SUGGESTIONS.length);
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        setFocused((i) => (i - 1 + SUGGESTIONS.length) % SUGGESTIONS.length);
      } else if (ev.key === 'Enter') {
        // Only steal Enter if the popover is the meaningful target — i.e. the
        // Monaco editor is focused (so the user isn't tabbed into a form field).
        const el = findPromqlEditorDomNode();
        if (el?.contains(document.activeElement)) {
          ev.preventDefault();
          apply(SUGGESTIONS[focused], counterMetric.name);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, focused, counterMetric?.name]);

  // Click-outside to dismiss (but not clicks on the editor itself).
  useEffect(() => {
    if (!visible) {
      return;
    }
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (!t) {
        return;
      }
      if (wrapRef.current?.contains(t)) {
        return;
      }
      const editorEl = findPromqlEditorDomNode();
      if (editorEl?.contains(t)) {
        return;
      }
      dismiss();
    };
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    dismissedForCurrentText.current = editorText;
    setVisible(false);
  };

  const apply = (s: Suggestion, metric: string) => {
    replaceEditorText(s.build(metric));
    // After replacement, editor content changes → subscribeToEditor fires with
    // the wrapped expression, isBareMetric() returns null, popover hides.
  };

  // Guard rendering. Note the effects above ALL run every render regardless of
  // these guards — that's intentional so subscriptions stay stable.
  if (!visible || !counterMetric || !anchorRect) {
    return null;
  }
  // Suppress re-triggering for the same non-bare text after dismiss.
  if (dismissedForCurrentText.current === editorText) {
    return null;
  }

  const width = Math.max(420, Math.min(anchorRect.width - 16, 640));
  const style: React.CSSProperties = {
    top: anchorRect.bottom + 4,
    left: anchorRect.left + 8,
    width,
  };

  return createPortal(
    <div ref={wrapRef} className={styles.wrap} style={style} role="dialog" aria-label="Query suggestions">
      <div className={styles.header}>Suggestions</div>
      <ul className={styles.list}>
        {SUGGESTIONS.map((s, idx) => {
          const isFocused = idx === focused;
          return (
            <li key={s.label}>
              <button
                type="button"
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                className={cx(styles.item, isFocused && styles.itemFocused)}
                onMouseEnter={() => setFocused(idx)}
                onFocus={() => setFocused(idx)}
                onClick={() => apply(s, counterMetric.name)}
              >
                <div className={styles.itemBody}>
                  <span className={styles.itemLabel}>{s.label}</span>
                  <code className={styles.itemPreview}>
                    <span className={styles.previewFn}>{s.prefix}</span>
                    <span className={styles.previewMetric}>{counterMetric.name}</span>
                    <span className={styles.previewFn}>{s.suffix}</span>
                  </code>
                </div>
                {isFocused && (
                  <span className={styles.enterHint} aria-label="Enter">
                    &#x21B5;
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // No horizontal padding on the wrap so the focused-item highlight can span
  // edge-to-edge inside the popover; the header + items provide their own
  // consistent horizontal indent.
  wrap: css({
    position: 'fixed',
    zIndex: theme.zIndex.modal,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    padding: theme.spacing(1, 0),
  }),
  header: css({
    padding: theme.spacing(0, 1.5, 0.5),
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  // Only the JS-tracked focused item gets a background — no CSS :hover or
  // :focus-visible so the highlight can't split between two items when the
  // mouse and keyboard focus different rows.
  item: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0.75, 1.5),
    background: 'transparent',
    border: 'none',
    borderRadius: 'unset',
    color: theme.colors.text.primary,
    textAlign: 'left',
    cursor: 'pointer',
    outline: 'none',
  }),
  itemFocused: css({
    background: theme.colors.action.selected,
  }),
  itemBody: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    minWidth: 0,
    flex: 1,
  }),
  itemLabel: css({
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  itemPreview: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.size.sm,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  previewFn: css({
    color: theme.visualization.getColorByName('blue'),
  }),
  previewMetric: css({
    color: theme.colors.text.primary,
  }),
  enterHint: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.md,
    flexShrink: 0,
  }),
});
