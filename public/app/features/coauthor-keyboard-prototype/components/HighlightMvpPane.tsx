import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, TextLink, useStyles2 } from '@grafana/ui';

import { getCaretCoordinates } from '../logic/caret';
import { TOPK_QUERY } from '../logic/flows';
import {
  applyOps,
  interpretV2,
  isCoauthorShortcut,
  previewFromRanges,
  V2_LOOKS_LIKE,
  type V2Change,
} from '../logic/highlightV2';
import { analyzeSection, type Section } from '../logic/tokens';

import { CoauthorPopoverV2, type V2Content } from './CoauthorPopoverV2';
import { FeedbackModal } from './FeedbackModal';
import { HighlightedQueryEditor } from './HighlightedQueryEditor';
import { type Pos } from './KeyboardPopover';
import { SelectionToolbar, TOOLBAR_HEIGHT, TOOLBAR_WIDTH } from './SelectionToolbar';

interface Props {
  /** Chat hands the conversation to the (mock) assistant sidebar. */
  onOpenAssistant?: (a: { title: string; body: string }) => void;
}

/**
 * V1 MVP of the highlight flow — the smallest thing worth shipping.
 *
 * Differences from the full flow (HighlightV2Pane): no query map, no
 * quick-change chips, exactly one suggestion with no iteration, and modifying
 * means continuing in the assistant sidebar rather than in the popover.
 */
export function HighlightMvpPane({ onOpenAssistant }: Props) {
  const styles = useStyles2(getStyles);

  const [workingRaw, setWorkingRaw] = useState(TOPK_QUERY);
  // At most one suggestion is live at a time — no history to page through.
  const [change, setChange] = useState<V2Change | null>(null);
  const [content, setContent] = useState<V2Content | null>(null);
  const [pos, setPos] = useState<Pos>({ left: 0, top: 0 });
  const [toolbar, setToolbar] = useState<Pos | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [feedbackModal, setFeedbackModal] = useState<'up' | 'down' | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<Section | null>(null);
  const anchorRef = useRef(0);
  const selRef = useRef<{ start: number; end: number } | null>(null);
  const gestureRef = useRef(false);
  const seq = useRef(0);

  const draft = applyOps(workingRaw, anchorRef.current, change ? [change.op] : []);
  const hasPending = draft.ranges.length > 0;
  const preview = hasPending ? previewFromRanges(draft.text, draft.ranges) : null;

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
    // Dismissing rejects the suggestion.
    setChange(null);
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
  // Same rule as the full flow: track always, only show once the highlight is
  // finished (mouse up / modifiers released).
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

  const onEditorMouseDown = () => {
    gestureRef.current = true;
    setToolbar(null);
  };

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      gestureRef.current = true;
    }
  };

  const onEditorKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      gestureRef.current = false;
      syncSelection(true);
    }
  };

  // -- Actions ------------------------------------------------------------
  const onCopy = () => {
    const sel = selRef.current;
    if (!sel) {
      return;
    }
    navigator.clipboard?.writeText(workingRaw.slice(sel.start, sel.end));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const openCoauthor = () => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }
    seq.current++;
    setToolbar(null);
    setInputValue('');
    setPos(anchorBelow(section.end, 380));
    setContent({ kind: 'main', loading: true, looksLike: V2_LOOKS_LIKE, minimal: true });
    later(900, () => setContent({ kind: 'main', loading: false, looksLike: V2_LOOKS_LIKE, minimal: true }));
  };

  const onSubmit = () => {
    const text = inputValue.trim();
    if (content?.kind !== 'main' || !text) {
      return;
    }
    const next = interpretV2(text, 0, analyzeSection(draft.text, anchorRef.current, anchorRef.current));
    seq.current++;
    setInputValue('');
    setPos(anchorBelow(sectionRef.current?.end ?? 0, 520));
    setContent({ kind: 'building', prompt: text, nodes: next.building });
    later(1600, () => {
      setChange(next);
      setContent({
        kind: 'result',
        why: next.why,
        nodes: next.result,
        feedback: null,
        index: 0,
        total: 1,
        actions: 'mvp',
      });
    });
  };

  // Stopping mid-build drops back to the prompt; nothing was applied yet.
  const onStop = () => {
    seq.current++;
    setInputValue('');
    setContent({ kind: 'main', loading: false, looksLike: V2_LOOKS_LIKE, minimal: true });
  };

  const onAccept = () => {
    setWorkingRaw(draft.text);
    setChange(null);
    seq.current++;
    setContent(null);
    setToolbar(null);
  };

  // The suggestion stays on screen and still acceptable — the sidebar is just
  // where any further back-and-forth happens.
  const onChat = () => {
    const section = sectionRef.current;
    const selected = section ? workingRaw.slice(section.start, section.end) : workingRaw;
    onOpenAssistant?.({
      title: 'Query coauthor',
      body: `Working on ${selected}. Suggested: ${change?.why ?? ''} Ask for a different approach, or keep refining here.`,
    });
  };

  const onFeedbackSubmit = () => {
    setContent((c) => (c?.kind === 'result' ? { ...c, feedback: feedbackModal } : c));
    setFeedbackModal(null);
  };

  const reset = () => {
    closeAll();
    setWorkingRaw(TOPK_QUERY);
    sectionRef.current = null;
  };

  // -- Global keys / clicks ----------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isCoauthorShortcut(e) && !content && sectionRef.current && toolbar) {
        e.preventDefault();
        openCoauthor();
        return;
      }
      if (e.key === 'Escape' && !feedbackModal && (content || toolbar)) {
        e.preventDefault();
        e.stopPropagation();
        closeAll();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, toolbar, feedbackModal]);

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
      if (feedbackModal) {
        return;
      }
      const t = e.target;
      if (t instanceof Element && (t.closest('[data-coauthor-popover]') || t.closest('[data-coauthor-toolbar]'))) {
        return;
      }
      // Clicks in the assistant sidebar shouldn't drop the suggestion.
      if (t instanceof Element && t.closest('[data-coauthor-assistant]')) {
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
          <span className={styles.scenarioLabel}>Highlight flow — v1 MVP · highlight part of the query to start</span>
          <span className={styles.scenarioBtns}>
            <button className={styles.scenarioBtn} onClick={reset}>
              Reset
            </button>
            <TextLink href="/coauthor-highlight" variant="bodySmall">
              Full flow
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
              />
            </div>

            {toolbar && !content && (
              <SelectionToolbar
                pos={toolbar}
                copied={copied}
                showQueryMap={false}
                onCopy={onCopy}
                onQueryMap={() => {}}
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
                onBack={onStop}
                onStop={onStop}
                onAction={() => {}}
                onSuggestion={() => {}}
                onSuggestionHover={() => {}}
                onFeedback={setFeedbackModal}
                onInsert={() => {}}
                onEdit={onChat}
                onAccept={onAccept}
                onWorkspace={closeAll}
                onCoauthor={openCoauthor}
                onStep={() => {}}
                onChat={onChat}
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
  scenarioBtns: css({ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: theme.spacing(1.5) }),
  scenarioBtn: css({
    all: 'unset',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': { background: theme.colors.background.secondary, color: theme.colors.text.primary },
  }),

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
});
