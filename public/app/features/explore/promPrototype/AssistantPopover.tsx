// Prototype-only. Not internationalized.
// Grafana Assistant integration (Option C). Triggered by typing "/ " (slash
// followed by space) anywhere in the PromQL editor. The two trigger chars are
// consumed and a popover opens anchored below the editor with a natural-
// language input. Starter prompts show only when the editor was empty at
// trigger time. Submitting produces a mocked multi-step plan the user can add
// piecewise or all at once.

import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getNextRefId, type GrafanaTheme2 } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { Button, Icon, IconButton, Input, useStyles2 } from '@grafana/ui';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { changeQueries } from '../state/query';

import { usePromPrototype } from './PromPrototypeContext';
import { STARTERS, planFor, shapePrediction, type AssistantPlan } from './assistantMock';
import { findPromqlEditorDomNode, replaceEditorText, setCursorOffset, subscribeToEditor } from './promEditorBridge';

type Mode = 'input' | 'plan';

interface PopoverState {
  wasEmptyOnTrigger: boolean;
  anchor: DOMRect;
}

export function AssistantPopover() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const { option } = usePromPrototype();

  // Target the first Prometheus pane. Split-view multi-pane isn't a demo
  // requirement — a single pane is the common flow.
  const panes = useSelector((state: StoreState) => state.explore.panes);
  const firstEntry = Object.entries(panes)[0];
  const targetExploreId = firstEntry?.[0];
  const targetPane = firstEntry?.[1];
  const isPrometheus = targetPane?.datasourceInstance?.type === 'prometheus';

  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);
  const [mode, setMode] = useState<Mode>('input');
  const [question, setQuestion] = useState('');
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Guard against re-triggering while we're consuming the "/ " chars.
  const consumingRef = useRef(false);

  const active = option === 'c' && isPrometheus;

  // Rewrite the PromQL editor's empty-state placeholder so it mentions the
  // "/ " trigger. The vanilla placeholder is set via a Monaco decoration whose
  // className is an emotion-generated `css-XXXX` that renders `content` on
  // ::after. We don't know that class name at build time, so poll the DOM,
  // find the element whose ::after has non-empty content inside a
  // .monaco-editor, extract its emotion class, and inject a rule that
  // overrides just that class. Runs only while Option C is selected.
  useEffect(() => {
    if (!active) {
      return;
    }
    const CUSTOM_TEXT = 'Enter PromQL query, or type /+space to ask in plain language';
    const injected = new Map<string, HTMLStyleElement>();
    let cancelled = false;

    const injectFor = (className: string) => {
      if (injected.has(className)) {
        return;
      }
      const style = document.createElement('style');
      style.setAttribute('data-prom-proto-placeholder', className);
      // Match either the element itself carrying the class, or the class
      // used as a Monaco line-decoration className.
      style.textContent = `
        .${className}::after,
        .monaco-editor .view-line.${className}::after,
        .monaco-editor .${className}::after {
          content: '${CUSTOM_TEXT}' !important;
        }
      `;
      document.head.appendChild(style);
      injected.set(className, style);
    };

    const scan = () => {
      if (cancelled) {
        return;
      }
      const candidates = document.querySelectorAll('.monaco-editor [class*="css-"]');
      candidates.forEach((el) => {
        const after = window.getComputedStyle(el, '::after');
        const content = after.content;
        if (!content || content === 'none' || content === 'normal' || content === '""') {
          return;
        }
        // Skip our own already-injected class.
        for (const cls of Array.from(el.classList)) {
          if (cls.startsWith('css-') && !injected.has(cls)) {
            injectFor(cls);
          }
        }
      });
    };

    scan();
    const interval = window.setInterval(scan, 750);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      injected.forEach((style) => style.remove());
      injected.clear();
    };
  }, [active]);

  // Trigger detection: watch editor content for a freshly-typed "/ " at cursor.
  useEffect(() => {
    if (!active) {
      return;
    }
    return subscribeToEditor((snap) => {
      if (popoverState || consumingRef.current) {
        return;
      }
      if (snap.cursor < 2) {
        return;
      }
      if (snap.text.slice(snap.cursor - 2, snap.cursor) !== '/ ') {
        return;
      }
      // Consume the "/ " chars.
      consumingRef.current = true;
      const before = snap.text.slice(0, snap.cursor - 2);
      const after = snap.text.slice(snap.cursor);
      const nextText = before + after;
      replaceEditorText(nextText, false);
      setCursorOffset(before.length);
      // Snapshot whether the editor was empty (ignoring the trigger chars).
      const wasEmpty = nextText.trim().length === 0;
      const editorEl = findPromqlEditorDomNode();
      const anchor = editorEl?.getBoundingClientRect() ?? new DOMRect(200, 200, 400, 40);
      setPopoverState({ wasEmptyOnTrigger: wasEmpty, anchor });
      setMode('input');
      setQuestion('');
      setPlan(null);
      // Let subsequent editor events settle before we allow another trigger.
      window.setTimeout(() => {
        consumingRef.current = false;
      }, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, popoverState]);

  // Close on Escape.
  useEffect(() => {
    if (!popoverState) {
      return;
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popoverState]);

  // Click-outside dismisses (but not clicks on the editor).
  useEffect(() => {
    if (!popoverState) {
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
      close();
    };
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popoverState]);

  // Autofocus the input each time we open or return to input mode.
  useEffect(() => {
    if (popoverState && mode === 'input') {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [popoverState, mode]);

  const close = () => {
    setPopoverState(null);
    setMode('input');
    setQuestion('');
    setPlan(null);
    setRecentlyAdded(null);
  };

  const submit = () => {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    setPlan(planFor(trimmed));
    setMode('plan');
  };

  const buildQuery = (expr: string, refId: string): DataQuery & { expr: string } => ({
    refId,
    expr,
    datasource: targetPane?.datasourceInstance?.getRef(),
  });

  // If the pane already has an empty query row, reuse it for the first
  // expression (so the query the user typed "/ " into becomes the filled one)
  // and append the rest as new rows. If no empty row exists, everything is
  // appended.
  const appendQueries = (exprs: string[]) => {
    if (!targetExploreId || exprs.length === 0) {
      return;
    }
    const next = [...(targetPane?.queries ?? [])];
    const emptyIdx = next.findIndex((q) => {
      const expr = (q as { expr?: unknown }).expr;
      return typeof expr !== 'string' || expr.trim().length === 0;
    });
    let startIdx = 0;
    if (emptyIdx >= 0) {
      next[emptyIdx] = buildQuery(exprs[0], next[emptyIdx].refId);
      startIdx = 1;
    }
    for (let i = startIdx; i < exprs.length; i++) {
      const refId = getNextRefId(next);
      next.push(buildQuery(exprs[i], refId));
    }
    dispatch(changeQueries({ exploreId: targetExploreId, queries: next }));
  };

  const addStep = (idx: number, expr: string) => {
    appendQueries([expr]);
    setRecentlyAdded(idx);
    window.setTimeout(() => {
      setRecentlyAdded((cur) => (cur === idx ? null : cur));
    }, 1000);
  };

  const addAll = () => {
    if (!plan) {
      return;
    }
    appendQueries(plan.steps.map((s) => s.query));
    close();
  };

  const usableStarters = useMemo(() => (popoverState?.wasEmptyOnTrigger ? STARTERS : []), [popoverState]);

  if (!active || !popoverState) {
    return null;
  }

  const { anchor } = popoverState;
  const width = Math.max(420, Math.min(anchor.width, 720));
  const style: React.CSSProperties = {
    top: anchor.bottom + 4,
    left: anchor.left + 8,
    width,
  };

  return createPortal(
    <div ref={wrapRef} className={styles.wrap} style={style} role="dialog" aria-label="Grafana Assistant">
      {mode === 'input' && (
        <>
          <div className={styles.inputRow}>
            <Icon name="ai-sparkle" className={styles.inputIcon} />
            <Input
              ref={inputRef as never}
              value={question}
              placeholder="Describe your idea or ask a question."
              onChange={(e) => setQuestion(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {question.trim().length > 0 && (
              <IconButton name="check" aria-label="Send" tooltip="Send (Enter)" onClick={submit} variant="primary" />
            )}
          </div>
          {usableStarters.length > 0 && (
            <ul className={styles.starterList}>
              {usableStarters.map((s) => (
                <li key={s.label}>
                  <button type="button" className={styles.starterBtn} onClick={() => setQuestion(s.question)}>
                    <Icon name="comment-alt" className={styles.starterIcon} />
                    <span className={styles.starterLabel}>{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {mode === 'plan' && plan && (
        <>
          <p className={styles.framing}>{plan.framing}</p>
          <ol className={styles.stepList}>
            {plan.steps.map((step, idx) => {
              const added = recentlyAdded === idx;
              return (
                <li key={idx} className={styles.step}>
                  <div className={styles.stepHeader}>
                    <span className={styles.stepLabel}>{step.label}</span>
                    <IconButton
                      name={added ? 'check' : 'plus'}
                      aria-label={`Add ${step.label} as a new query`}
                      tooltip={added ? 'Added' : 'Add as new query'}
                      onClick={() => addStep(idx, step.query)}
                      className={cx(added && styles.addBtnAdded)}
                    />
                  </div>
                  <code className={styles.queryBlock}>{step.query}</code>
                  <div className={styles.shape}>
                    <Icon name="chart-line" size="xs" />
                    <span>{shapePrediction(step.query)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          {plan.steps.length > 1 && (
            <div className={styles.addAllRow}>
              <Button variant="primary" onClick={addAll} icon="plus">
                Add all {plan.steps.length} queries
              </Button>
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    position: 'fixed',
    zIndex: theme.zIndex.modal,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    padding: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    maxHeight: '75vh',
    overflowY: 'auto',
  }),
  inputRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1),
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    '& > div': {
      // Grafana Input renders a wrapper div; let it flex-fill.
      flex: 1,
    },
  }),
  inputIcon: css({
    color: theme.colors.primary.text,
    flexShrink: 0,
  }),
  starterList: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  starterBtn: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0.75, 1),
    background: 'transparent',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    fontSize: theme.typography.size.sm,
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  starterIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  starterLabel: css({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  framing: css({
    margin: 0,
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.primary,
    lineHeight: 1.4,
  }),
  stepList: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  step: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  stepHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),
  stepLabel: css({
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  queryBlock: css({
    display: 'block',
    padding: theme.spacing(0.75, 1),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.primary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  shape: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    fontStyle: 'italic',
  }),
  addBtnAdded: css({
    color: theme.colors.success.text,
  }),
  addAllRow: css({
    display: 'flex',
    justifyContent: 'flex-start',
    marginTop: theme.spacing(0.5),
  }),
});
