import { css, cx } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, TextLink, useStyles2 } from '@grafana/ui';

import { getCaretCoordinates } from '../logic/caret';
import { FLOW1, TOPK_QUERY, type Suggestion } from '../logic/flows';
import {
  applyOps,
  buildQueryMap,
  changeForSuggestion,
  interpretV2,
  isCoauthorShortcut,
  isOutOfScope,
  previewFromRanges,
  TYPO_METRIC,
  TYPO_QUERY,
  V2_FIX_TYPO,
  V2_LOOKS_LIKE,
  V2_LOOKS_LIKE_TYPO,
  V2_SMOOTH,
  type V2Change,
  type V2Op,
} from '../logic/highlightV2';
import { analyzeSection, type Section } from '../logic/tokens';

import { CoauthorPopoverV2, type V2Content } from './CoauthorPopoverV2';
import { FeedbackModal } from './FeedbackModal';
import { HighlightedQueryEditor } from './HighlightedQueryEditor';
import { type Pos } from './KeyboardPopover';
import { SelectionToolbar, TOOLBAR_HEIGHT, TOOLBAR_WIDTH } from './SelectionToolbar';

interface Props {
  /** Lets the page list the panel's queries in its left rail. */
  onQueriesChange?: (refIds: string[]) => void;
}

/**
 * Highlight flow v2. Highlighting offers a small toolbar (Copy / Query map /
 * Coauthor) instead of jumping straight into AI; only Coauthor — by click or
 * cmd+/ — opens the coauthor popover, and suggestions land in the query as
 * pending (blue) edits until accepted, inserted as a new query, or dismissed.
 *
 * The original flow lives in KeyboardQueryPane and is untouched.
 */
export function HighlightV2Pane({ onQueriesChange }: Props) {
  const styles = useStyles2(getStyles);

  const [scenario, setScenario] = useState<'clean' | 'typo'>('clean');
  const [workingRaw, setWorkingRaw] = useState(TOPK_QUERY);
  // Every suggestion in this conversation, oldest first, plus which one the
  // popover is showing. The query reads as base + history[0..viewIndex].
  const [history, setHistory] = useState<V2Change[]>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const [hoverOp, setHoverOp] = useState<V2Op | null>(null);
  const [content, setContent] = useState<V2Content | null>(null);
  const [pos, setPos] = useState<Pos>({ left: 0, top: 0 });
  const [toolbar, setToolbar] = useState<Pos | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [feedbackModal, setFeedbackModal] = useState<'up' | 'down' | null>(null);
  const [inserted, setInserted] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<Section | null>(null);
  // Offset inside the edited section; survives the edits themselves.
  const anchorRef = useRef(0);
  const selRef = useRef<{ start: number; end: number } | null>(null);
  // True while a highlight is still being dragged / extended.
  const gestureRef = useRef(false);
  const seq = useRef(0);

  // The query as it currently reads, including pending (unaccepted) edits.
  const viewedOps = history.slice(0, viewIndex + 1).map((c) => c.op);
  const draft = applyOps(workingRaw, anchorRef.current, hoverOp ? [...viewedOps, hoverOp] : viewedOps);
  const hasPending = draft.ranges.length > 0;
  const preview = hasPending ? previewFromRanges(draft.text, draft.ranges) : null;

  // Squiggle whatever is left of the typo — it disappears once the fix is
  // pending, since the range is looked up in the draft.
  const typoAt = draft.text.indexOf(TYPO_METRIC);
  const errorRange = typoAt >= 0 ? { start: typoAt, end: typoAt + TYPO_METRIC.length } : null;
  const looksLike = errorRange ? V2_LOOKS_LIKE_TYPO : V2_LOOKS_LIKE;

  useEffect(() => {
    onQueriesChange?.(inserted ? ['A', 'B'] : ['A']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inserted]);

  const later = (ms: number, fn: () => void) => {
    const my = seq.current;
    window.setTimeout(() => {
      if (seq.current === my) {
        fn();
      }
    }, ms);
  };

  const closeAll = () => {
    seq.current++;
    setContent(null);
    setToolbar(null);
    setInputValue('');
    setHoverOp(null);
    // Dismissing rejects whatever hadn't been accepted yet.
    setHistory([]);
    setViewIndex(0);
  };

  const anchorBelow = (offset: number, width: number): Pos => {
    const ta = editorRef.current;
    const wrap = wrapRef.current;
    if (!ta || !wrap) {
      return { left: 0, top: 40 };
    }
    const c = getCaretCoordinates(ta, offset);
    const taRect = ta.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const left = Math.max(0, Math.min(taRect.left - wrapRect.left + c.left, wrap.clientWidth - width));
    return { left, top: taRect.top - wrapRect.top + c.top + c.height + 6 };
  };

  const anchorAbove = (start: number, end: number): Pos => {
    const ta = editorRef.current;
    const wrap = wrapRef.current;
    if (!ta || !wrap) {
      return { left: 0, top: 0 };
    }
    const a = getCaretCoordinates(ta, start);
    const b = getCaretCoordinates(ta, end);
    const taRect = ta.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const sameLine = Math.abs(a.top - b.top) < 2;
    const center = sameLine ? (a.left + b.left) / 2 : a.left;
    const left = Math.max(
      0,
      Math.min(taRect.left - wrapRect.left + center - TOOLBAR_WIDTH / 2, wrap.clientWidth - TOOLBAR_WIDTH)
    );
    return { left, top: taRect.top - wrapRect.top + a.top - TOOLBAR_HEIGHT - 6 };
  };

  // -- Selection ----------------------------------------------------------
  /**
   * `commit` is false while the highlight is still being made (mouse held down,
   * or shift/cmd held for a keyboard selection). The section is tracked either
   * way, but the toolbar only appears once the gesture is finished — otherwise
   * it chases the cursor mid-drag.
   */
  const syncSelection = (commit: boolean) => {
    const ta = editorRef.current;
    if (!ta || content || hasPending) {
      return;
    }
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const section = s === e ? null : analyzeSection(workingRaw, s, e);
    if (!section) {
      sectionRef.current = null;
      selRef.current = null;
      setToolbar(null);
      return;
    }
    sectionRef.current = section;
    anchorRef.current = section.fn.start;
    selRef.current = { start: s, end: e };
    if (!commit) {
      setToolbar(null);
      return;
    }
    setCopied(false);
    setToolbar(anchorAbove(s, e));
  };

  // Mouse or modifier still down → the highlight isn't finished yet.
  const onEditorMouseDown = () => {
    gestureRef.current = true;
    setToolbar(null);
  };

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      gestureRef.current = true;
    }
  };

  // Releasing the last modifier ends a keyboard selection.
  const onEditorKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      gestureRef.current = false;
      syncSelection(true);
    }
  };

  // -- Toolbar actions ----------------------------------------------------
  const onCopy = () => {
    const sel = selRef.current;
    if (!sel) {
      return;
    }
    navigator.clipboard?.writeText(workingRaw.slice(sel.start, sel.end));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const onQueryMap = () => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }
    seq.current++;
    setToolbar(null);
    setPos(anchorBelow(section.end, 700));
    setContent({ kind: 'map', nodes: buildQueryMap(section) });
  };

  const mainContent = (loading: boolean): V2Content => ({
    kind: 'main',
    loading,
    looksLike,
    hasError: Boolean(errorRange),
  });

  const openCoauthor = () => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }
    seq.current++;
    setToolbar(null);
    setInputValue('');
    setPos(anchorBelow(section.end, 380));
    setContent(mainContent(true));
    later(900, () => setContent(mainContent(false)));
  };

  // -- Suggestion machinery ----------------------------------------------
  const resultContent = (index: number, list: V2Change[]): V2Content => ({
    kind: 'result',
    why: list[index].why,
    nodes: list[index].result,
    feedback: null,
    index,
    total: list.length,
  });

  // Every suggestion — typed or picked from a chip — runs the same path:
  // build (with a stop) → apply as a pending edit → result.
  const runChange = (change: V2Change, prompt: string) => {
    seq.current++;
    setHoverOp(null);
    setInputValue('');
    setPos(anchorBelow(sectionRef.current?.end ?? 0, 520));
    setContent({ kind: 'building', prompt, nodes: change.building });
    later(1600, () => {
      // Prompting while paged back to an earlier suggestion branches from that
      // one, so the conversation always reads forward.
      const next = [...history.slice(0, viewIndex + 1), change];
      setHistory(next);
      setViewIndex(next.length - 1);
      setContent(resultContent(next.length - 1, next));
    });
  };

  // An ask that needs other datasources or extra queries can't be answered
  // here, so it ends in a hand-off instead of a suggestion. The query is left
  // exactly as it was.
  const runOutOfScope = (prompt: string) => {
    seq.current++;
    setHoverOp(null);
    setInputValue('');
    setPos(anchorBelow(sectionRef.current?.end ?? 0, 520));
    setContent({ kind: 'building', prompt, nodes: V2_SMOOTH.building });
    later(1600, () => setContent({ kind: 'out-of-scope', feedback: null }));
  };

  const onSubmit = () => {
    if (!content) {
      return;
    }
    const text = inputValue.trim();
    if ((content.kind === 'main' || content.kind === 'modify' || content.kind === 'sub') && text) {
      if (isOutOfScope(text)) {
        runOutOfScope(text);
        return;
      }
      // "fix the typo" and friends only mean anything while the query is broken.
      if (errorRange && /typo|spell|fix|error|invalid|unknown|exist/.test(text.toLowerCase())) {
        runChange(V2_FIX_TYPO, text);
        return;
      }
      // Interpret against the query as it stands, so a follow-up prompt builds
      // on the pending edits rather than the original.
      runChange(
        interpretV2(text, viewedOps.length, analyzeSection(draft.text, anchorRef.current, anchorRef.current)),
        text
      );
    }
  };

  // The prototype has nowhere real to go — acknowledge and close.
  const onWorkspace = () => {
    seq.current++;
    setContent({ kind: 'handoff' });
    later(1300, () => closeAll());
  };

  const onAction = (id: 'fix-error' | 'swap-function' | 'change-window') => {
    if (id === 'fix-error') {
      runChange(V2_FIX_TYPO, 'Fix error');
      return;
    }
    setInputValue('');
    setPos(anchorBelow(sectionRef.current?.end ?? 0, 440));
    setContent(
      id === 'swap-function'
        ? {
            kind: 'sub',
            title: 'Swap function',
            placeholder: 'Describe what function you want',
            suggestions: FLOW1.swapFunction,
            tone: 'green',
          }
        : {
            kind: 'sub',
            title: 'Change window',
            placeholder: 'Describe what window you want',
            suggestions: FLOW1.changeWindow,
            tone: 'amber',
          }
    );
  };

  const subKind = (): 'function' | 'window' =>
    content?.kind === 'sub' && content.title === 'Swap function' ? 'function' : 'window';

  const onSuggestion = (s: Suggestion) => {
    runChange(changeForSuggestion(subKind(), s, sectionRef.current), s.name);
  };

  // Hovering a suggestion previews it in the query without committing an op.
  const onSuggestionHover = (s: Suggestion | null) => {
    setHoverOp(s ? changeForSuggestion(subKind(), s, sectionRef.current).op : null);
  };

  const onStop = () => {
    seq.current++;
    setInputValue('');
    setContent(history.length ? resultContent(viewIndex, history) : mainContent(false));
  };

  // Paging back also rolls the editor back to that suggestion's query.
  const onStep = (delta: -1 | 1) => {
    const next = viewIndex + delta;
    if (next < 0 || next >= history.length) {
      return;
    }
    setViewIndex(next);
    setContent(resultContent(next, history));
  };

  // -- Result actions -----------------------------------------------------
  const onAccept = () => {
    setWorkingRaw(draft.text);
    setHistory([]);
    setViewIndex(0);
    seq.current++;
    setContent(null);
    setToolbar(null);
  };

  // Inserts only the part that changed as query B; A is left as it was.
  const onInsert = () => {
    const section = analyzeSection(draft.text, anchorRef.current, anchorRef.current);
    if (section) {
      setInserted(draft.text.slice(section.start, section.end));
    }
    setHistory([]);
    setViewIndex(0);
    seq.current++;
    setContent(null);
    setToolbar(null);
  };

  const onEdit = () => {
    setInputValue('');
    setPos(anchorBelow(sectionRef.current?.end ?? 0, 460));
    setContent({
      kind: 'modify',
      segments: previewFromRanges(draft.text, draft.ranges),
      index: viewIndex,
      total: history.length,
    });
  };

  const onBack = () => {
    setInputValue('');
    if (content?.kind === 'modify' && history.length) {
      setContent(resultContent(viewIndex, history));
    } else {
      setContent(mainContent(false));
    }
  };

  const onFeedbackSubmit = () => {
    setContent((c) => {
      if (c?.kind === 'result') {
        return { ...c, feedback: feedbackModal };
      }
      if (c?.kind === 'out-of-scope') {
        return { ...c, feedback: feedbackModal };
      }
      return c;
    });
    setFeedbackModal(null);
  };

  const chooseScenario = (s: 'clean' | 'typo') => {
    closeAll();
    setScenario(s);
    setWorkingRaw(s === 'typo' ? TYPO_QUERY : TOPK_QUERY);
    setInserted(null);
    sectionRef.current = null;
  };

  // -- Global keys / clicks ----------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Works from a finished highlight and from the query map, which advertises
      // the same shortcut.
      const canOpen = sectionRef.current && (content ? content.kind === 'map' : Boolean(toolbar));
      if (isCoauthorShortcut(e) && canOpen) {
        e.preventDefault();
        openCoauthor();
        return;
      }
      if (e.key === 'Escape') {
        if (feedbackModal) {
          return;
        }
        if (content || toolbar) {
          e.preventDefault();
          e.stopPropagation();
          closeAll();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, toolbar, feedbackModal]);

  // A textarea's `select` event doesn't fire when the selection collapses, so
  // the un-highlight case has to come from the document-level event. Mid-gesture
  // this only tracks / hides — the toolbar waits for mouseup below.
  useEffect(() => {
    const onSelectionChange = () => {
      if (document.activeElement !== editorRef.current) {
        return;
      }
      syncSelection(!gestureRef.current);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, workingRaw, hasPending]);

  // The drag can end anywhere, so the "highlight is finished" signal is a
  // document-level mouseup rather than one on the editor.
  useEffect(() => {
    const onUp = () => {
      if (!gestureRef.current) {
        return;
      }
      gestureRef.current = false;
      syncSelection(true);
    };
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, workingRaw, hasPending]);

  useEffect(() => {
    if (!content && !toolbar) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      // The feedback modal lives outside the popover — clicks in it aren't "outside".
      if (feedbackModal) {
        return;
      }
      const t = e.target;
      if (t instanceof Element && (t.closest('[data-coauthor-popover]') || t.closest('[data-coauthor-toolbar]'))) {
        return;
      }
      if (t instanceof Element && t.closest('textarea') && !content) {
        return;
      }
      closeAll();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, toolbar, feedbackModal]);

  const highlight = sectionRef.current && (content || toolbar) ? sectionRef.current : null;

  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        {/* Demo aids, not product UI */}
        <div className={styles.scenarioBar}>
          <span className={styles.scenarioLabel}>Highlight flow v2 — highlight part of the query to start</span>
          <span className={styles.scenarioBtns}>
            <button
              className={cx(styles.scenarioBtn, scenario === 'clean' && styles.scenarioActive)}
              onClick={() => chooseScenario('clean')}
            >
              Valid query
            </button>
            <button
              className={cx(styles.scenarioBtn, scenario === 'typo' && styles.scenarioActive)}
              onClick={() => chooseScenario('typo')}
            >
              With typo
            </button>
            <button className={styles.scenarioBtn} onClick={() => chooseScenario(scenario)}>
              Reset
            </button>
            <TextLink href="/coauthor-mvp" variant="bodySmall">
              MVP flow
            </TextLink>
            <TextLink href="/coauthor-components" variant="bodySmall">
              Components
            </TextLink>
          </span>
        </div>

        <div className={styles.dsRow}>
          <Icon name="database" size="sm" />
          <span className={styles.dsName}>grafanacloud-dev-prom</span>
          <Icon name="angle-down" size="sm" />
          <span className={styles.refId}>A</span>
          <IconButton name="pen" size="sm" aria-label="Edit ref" tooltip="Rename query" />
          <span className={styles.dsRight}>
            <span className={styles.dsAction}>
              <Icon name="repeat" size="sm" /> Replace
            </span>
            <IconButton name="eye" size="sm" aria-label="Toggle" tooltip="Hide response" />
            <IconButton name="trash-alt" size="sm" aria-label="Remove" tooltip="Remove query" />
          </span>
        </div>

        <div className={styles.toolbar}>
          <span className={styles.kickstart}>Kick start your query</span>
          <span className={styles.explain}>
            Explain
            <span className={styles.switch}>
              <span className={styles.switchKnob} />
            </span>
          </span>
          <span className={styles.spacer} />
          <span className={styles.runBtn}>Run queries</span>
          <div className={styles.modeToggle}>
            <span className={styles.modeItem}>Builder</span>
            <span className={styles.modeActive}>Code</span>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.editorRow} ref={wrapRef}>
            <span className={styles.metricsBrowser}>
              Metrics browser <Icon name="angle-right" size="sm" />
            </span>
            <div className={styles.editorArea}>
              <HighlightedQueryEditor
                value={workingRaw}
                placeholder="Enter a PromQL query"
                editorRef={editorRef}
                onChange={setWorkingRaw}
                onMouseDown={onEditorMouseDown}
                onKeyDown={onEditorKeyDown}
                onKeyUp={onEditorKeyUp}
                onSelect={() => syncSelection(!gestureRef.current)}
                preview={preview}
                highlightRange={highlight}
                errorRange={errorRange}
              />
            </div>

            {toolbar && !content && (
              <SelectionToolbar
                pos={toolbar}
                copied={copied}
                onCopy={onCopy}
                onQueryMap={onQueryMap}
                onCoauthor={openCoauthor}
              />
            )}

            {content && (
              <CoauthorPopoverV2
                pos={pos}
                content={content}
                value={inputValue}
                inputRef={inputRef}
                onInput={setInputValue}
                onSubmit={onSubmit}
                onBack={onBack}
                onStop={onStop}
                onAction={onAction}
                onSuggestion={onSuggestion}
                onSuggestionHover={onSuggestionHover}
                onFeedback={setFeedbackModal}
                onInsert={onInsert}
                onEdit={onEdit}
                onAccept={onAccept}
                onStep={onStep}
                onWorkspace={onWorkspace}
                onCoauthor={openCoauthor}
              />
            )}
          </div>

          <div className={styles.fetchHint}>
            <span className={styles.lineNo}>1</span>
            Fetch all series matching metric name and label filters.
          </div>
          <div className={styles.optionsRow}>
            <Icon name="angle-right" size="sm" /> Options
            <span className={styles.optionMeta}>Legend: Auto</span>
            <span className={styles.optionMeta}>Format: Time series</span>
            <span className={styles.optionMeta}>Step: auto</span>
            <span className={styles.optionMeta}>Type: Range</span>
          </div>
        </div>
      </div>

      {/* "Insert as new query" adds the changed section as its own query. */}
      {inserted && (
        <div className={styles.card}>
          <div className={styles.dsRow}>
            <Icon name="database" size="sm" />
            <span className={styles.dsName}>grafanacloud-dev-prom</span>
            <Icon name="angle-down" size="sm" />
            <span className={styles.refId}>B</span>
            <IconButton name="pen" size="sm" aria-label="Edit ref" tooltip="Rename query" />
            <span className={styles.dsRight}>
              <IconButton name="eye" size="sm" aria-label="Toggle" tooltip="Hide response" />
              <IconButton
                name="trash-alt"
                size="sm"
                aria-label="Remove"
                tooltip="Remove query"
                onClick={() => setInserted(null)}
              />
            </span>
          </div>
          <div className={styles.body}>
            <div className={styles.insertedQuery}>{inserted}</div>
            <div className={styles.optionsRow}>
              <Icon name="angle-right" size="sm" /> Options
              <span className={styles.optionMeta}>Legend: Auto</span>
              <span className={styles.optionMeta}>Format: Time series</span>
            </div>
          </div>
        </div>
      )}

      {feedbackModal && (
        <FeedbackModal kind={feedbackModal} onDismiss={() => setFeedbackModal(null)} onSubmit={onFeedbackSubmit} />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  stack: css({ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.spacing(1.5) }),
  card: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    display: 'flex',
    flexDirection: 'column',
  }),
  scenarioBar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.canvas,
  }),
  scenarioLabel: css({ color: theme.colors.text.disabled, fontSize: theme.typography.bodySmall.fontSize }),
  scenarioBtns: css({ marginLeft: 'auto', display: 'inline-flex', gap: theme.spacing(0.5) }),
  scenarioBtn: css({
    all: 'unset',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': { background: theme.colors.background.secondary, color: theme.colors.text.primary },
  }),
  scenarioActive: css({ background: theme.colors.background.secondary, color: theme.colors.text.primary }),

  dsRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.secondary,
  }),
  dsName: css({ color: theme.colors.text.primary }),
  refId: css({
    marginLeft: theme.spacing(1),
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  dsRight: css({ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: theme.spacing(1) }),
  dsAction: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: theme.typography.bodySmall.fontSize,
  }),

  toolbar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  kickstart: css({ color: theme.colors.text.primary }),
  explain: css({ display: 'inline-flex', alignItems: 'center', gap: theme.spacing(0.75) }),
  switch: css({
    width: 32,
    height: 18,
    borderRadius: 9,
    background: theme.colors.primary.main,
    position: 'relative',
    display: 'inline-block',
  }),
  switchKnob: css({
    position: 'absolute',
    top: 1,
    left: 15,
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: theme.colors.text.primary,
  }),
  spacer: css({ flex: 1 }),
  runBtn: css({ color: theme.colors.text.primary }),
  modeToggle: css({
    display: 'inline-flex',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  modeItem: css({ padding: theme.spacing(0.25, 1), color: theme.colors.text.secondary }),
  modeActive: css({
    padding: theme.spacing(0.25, 1),
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
  }),

  body: css({ padding: theme.spacing(1.5) }),
  editorRow: css({ position: 'relative', display: 'flex', gap: theme.spacing(1.5), alignItems: 'flex-start' }),
  metricsBrowser: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
    paddingTop: theme.spacing(1.25),
    flexShrink: 0,
  }),
  editorArea: css({ flex: 1, minWidth: 0 }),

  fetchHint: css({
    display: 'flex',
    gap: theme.spacing(1),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(1),
    marginTop: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  lineNo: css({ color: theme.colors.text.disabled }),
  optionsRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(1),
  }),
  optionMeta: css({ color: theme.colors.text.disabled }),

  insertedQuery: css({
    padding: theme.spacing(1.5),
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 1.8,
    color: theme.colors.text.primary,
  }),
});
