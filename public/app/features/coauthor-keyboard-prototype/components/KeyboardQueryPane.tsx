import { css, cx } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';

import { getCaretCoordinates } from '../logic/caret';
import {
  F3_ACCEPTED,
  F3_PREVIEW,
  F3_START,
  FLOW1,
  FLOW2,
  FLOW3,
  FLOW4,
  TOPK_QUERY,
  F2_PLACEHOLDER,
  interpretHighlightText,
  interpretModify4,
  windowValue,
  type ModifySuggestion,
  type PreviewSegment,
  type Suggestion,
} from '../logic/flows';
import { analyzeSection, applyChangeWindow, applySwapFunction, applySwapMetric, type Section } from '../logic/tokens';

import { HighlightedQueryEditor } from './HighlightedQueryEditor';
import { KeyboardPopover, type PopoverContent, type Pos } from './KeyboardPopover';
import { NUDGE_HEIGHT, NUDGE_WIDTH, SelectionNudge } from './SelectionNudge';

type Flow = 1 | 2 | 3 | 4;
type SubKind = 'swap-function' | 'swap-metric' | 'change-window';

const SCENARIOS: Array<{ flow: Flow; label: string; query: string }> = [
  { flow: 1, label: '1 · Highlight', query: TOPK_QUERY },
  { flow: 2, label: '2 · From scratch', query: '' },
  { flow: 3, label: '3 · Mid-query', query: F3_START },
  { flow: 4, label: '4 · Paste', query: '' },
];

interface Props {
  onFlowChange?: (flow: Flow) => void;
  onOpenAssistant?: (a: { title: string; body: string }) => void;
}

export function KeyboardQueryPane({ onFlowChange, onOpenAssistant }: Props) {
  const styles = useStyles2(getStyles);

  const [flow, setFlow] = useState<Flow>(1);
  const [workingRaw, setWorkingRaw] = useState(TOPK_QUERY);
  const [content, setContent] = useState<PopoverContent | null>(null);
  const [pos, setPos] = useState<Pos>({ left: 0, top: 0 });
  const [inputValue, setInputValue] = useState('');
  const [subKind, setSubKind] = useState<SubKind | null>(null);
  // Faded "proposed" query shown in the editor before it's committed.
  const [preview, setPreview] = useState<PreviewSegment[] | null>(null);
  // Persistent highlight over the section a popover refers to (Flow 1).
  const [highlight, setHighlight] = useState<{ start: number; end: number } | null>(null);
  // Flow 1: the "Explain or edit" pill offered while text is highlighted.
  const [nudge, setNudge] = useState<Pos | null>(null);
  // True after `/` is swallowed over a selection, until the completing space.
  const [slashPending, setSlashPending] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<Section | null>(null);
  const lastResultRef = useRef<PopoverContent | null>(null); // for Modify → back
  const pastedValueRef = useRef<string>(''); // detects "keep typing" after a paste
  const seq = useRef(0); // guards async transitions against close/reopen

  const closePopover = () => {
    seq.current++;
    setContent(null);
    setInputValue('');
    setSubKind(null);
    setPreview(null);
    setHighlight(null);
    setNudge(null);
    setSlashPending(false);
  };

  const later = (ms: number, fn: () => void) => {
    const my = seq.current;
    window.setTimeout(() => {
      if (seq.current === my) {
        fn();
      }
    }, ms);
  };

  const anchorAt = (offset: number): Pos => {
    const ta = editorRef.current;
    const wrap = wrapRef.current;
    if (!ta || !wrap) {
      return { left: 0, top: 40 };
    }
    const c = getCaretCoordinates(ta, offset);
    const taRect = ta.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const left = Math.max(0, Math.min(taRect.left - wrapRect.left + c.left, wrap.clientWidth - 430));
    const top = taRect.top - wrapRect.top + c.top + c.height + 6;
    return { left, top };
  };

  // The pill sits *above* the highlight, centred on it, so it never covers the
  // text the user just selected.
  const nudgeAnchorAt = (start: number, end: number): Pos => {
    const ta = editorRef.current;
    const wrap = wrapRef.current;
    if (!ta || !wrap) {
      return { left: 0, top: 0 };
    }
    const a = getCaretCoordinates(ta, start);
    const b = getCaretCoordinates(ta, end);
    const taRect = ta.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    // A multi-line selection has no meaningful centre — hug its start instead.
    const sameLine = Math.abs(a.top - b.top) < 2;
    const center = sameLine ? (a.left + b.left) / 2 : a.left;
    const left = Math.max(
      0,
      Math.min(taRect.left - wrapRect.left + center - NUDGE_WIDTH / 2, wrap.clientWidth - NUDGE_WIDTH)
    );
    return { left, top: taRect.top - wrapRect.top + a.top - NUDGE_HEIGHT - 6 };
  };

  // Temporary "Pasted query" nudge: auto-dismisses after 7s unless the user
  // interacts (typing, clicking away, or / + space all cancel it via seq).
  const openPastedPopover = (value: string) => {
    seq.current++;
    pastedValueRef.current = value;
    setInputValue('');
    setPreview(null);
    setHighlight(null);
    setPos(anchorAt(value.length));
    setContent({ kind: 'f4-pasted' });
    editorRef.current?.focus();
    later(7000, () => closePopover());
  };

  // -- Scenario switcher --------------------------------------------------
  const chooseScenario = (s: (typeof SCENARIOS)[number]) => {
    closePopover();
    setFlow(s.flow);
    onFlowChange?.(s.flow);
    setWorkingRaw(s.query);
    sectionRef.current = null;
  };

  // Real ⌘V paste: the browser fills the textarea, then we show the nudge.
  const handlePaste = () => {
    setFlow(4);
    onFlowChange?.(4);
    window.setTimeout(() => {
      const v = editorRef.current?.value ?? '';
      if (v.trim()) {
        openPastedPopover(v);
      }
    }, 0);
  };

  // Demo aid: drop an example query in as if it were pasted.
  const simulatePaste = () => {
    setFlow(4);
    onFlowChange?.(4);
    setWorkingRaw(FLOW4.pastedQuery);
    window.setTimeout(() => openPastedPopover(FLOW4.pastedQuery), 0);
  };

  // -- Editor triggers ----------------------------------------------------
  // Highlighting only offers the pill; the full popover waits for a click or
  // the `/` + space command. Un-highlighting takes the pill away again.
  const syncSelection = () => {
    const ta = editorRef.current;
    if (!ta) {
      return;
    }
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const section = s === e ? null : analyzeSection(workingRaw, s, e);
    if (!section) {
      sectionRef.current = null;
      setNudge(null);
      setSlashPending(false);
      return;
    }
    sectionRef.current = section;
    setNudge(nudgeAnchorAt(s, e));
  };

  // Opens the full Flow 1 experience over the section the pill was offered for,
  // so the highlight survives losing the textarea's native selection.
  const openHighlightFlow = () => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }
    seq.current++;
    setNudge(null);
    setSlashPending(false);
    setPos(anchorAt(section.end));
    setInputValue('');
    setSubKind(null);
    setPreview(null);
    // Keep the snapped section visibly highlighted while the popover is open.
    setHighlight({ start: section.start, end: section.end });
    setContent({ kind: 'f1-main', loading: true, summary: FLOW1.summary });
    later(900, () => setContent({ kind: 'f1-main', loading: false, summary: FLOW1.summary }));
  };

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const hasSelection = ev.currentTarget.selectionStart !== ev.currentTarget.selectionEnd;

    // Over a highlight, typing `/` would replace the selection — swallow it and
    // wait for the space that completes the command.
    if (ev.key === '/' && hasSelection && sectionRef.current) {
      ev.preventDefault();
      setSlashPending(true);
      return;
    }
    if (slashPending) {
      if (ev.key === ' ') {
        ev.preventDefault();
        openHighlightFlow();
        return;
      }
      // Anything other than a bare modifier abandons the half-typed command.
      if (!['Shift', 'Meta', 'Control', 'Alt'].includes(ev.key)) {
        setSlashPending(false);
      }
    }

    if (ev.key === ' ') {
      const ta = ev.currentTarget;
      const p = ta.selectionStart;
      if (workingRaw[p - 1] === '/') {
        ev.preventDefault();
        const next = workingRaw.slice(0, p - 1) + workingRaw.slice(p);
        setWorkingRaw(next);
        seq.current++;
        setInputValue('');
        setPreview(null);
        setPos(anchorAt(p - 1));
        if (next.trim() === '') {
          setContent({ kind: 'f2-scratch', loading: true, summary: FLOW2.datasourceSummary, chips: [] });
          later(1000, () =>
            setContent({
              kind: 'f2-scratch',
              loading: false,
              summary: FLOW2.datasourceSummary,
              chips: FLOW2.chips.map((c) => c.label),
            })
          );
        } else if (flow === 4) {
          // Complete (pasted) query: analyze, but no completion/fix suggestions.
          setContent({
            kind: 'f4-analyze',
            loading: true,
            looksLike: FLOW4.looksLike,
            flowNodes: FLOW4.flow,
            suggestions: FLOW4.suggestions,
          });
          later(1000, () =>
            setContent({
              kind: 'f4-analyze',
              loading: false,
              looksLike: FLOW4.looksLike,
              flowNodes: FLOW4.flow,
              suggestions: FLOW4.suggestions,
            })
          );
        } else {
          setContent({ kind: 'f3-analyze', loading: true, looksLike: FLOW3.looksLike, hovered: null });
          later(1000, () => {
            setContent({ kind: 'f3-analyze', loading: false, looksLike: FLOW3.looksLike, hovered: null });
            // Show both proposed additions (le + histogram_quantile) faded in the query.
            setPreview(F3_PREVIEW);
          });
        }
      }
    }
  };

  // -- Popover callbacks --------------------------------------------------
  const applyInterpretation = (kind: 'metric' | 'function' | 'window', value: string) => {
    if (!sectionRef.current) {
      return;
    }
    let next = workingRaw;
    if (kind === 'metric') {
      next = applySwapMetric(workingRaw, sectionRef.current, value);
    } else if (kind === 'function') {
      next = applySwapFunction(workingRaw, sectionRef.current, value);
    } else {
      next = applyChangeWindow(workingRaw, sectionRef.current, value);
    }
    setWorkingRaw(next);
    closePopover();
  };

  const onSubmit = () => {
    if (!content) {
      return;
    }
    const text = inputValue;
    switch (content.kind) {
      case 'f1-main':
      case 'f1-sub': {
        const interp = interpretHighlightText(text);
        if (interp) {
          applyInterpretation(interp.kind, interp.value);
        }
        break;
      }
      case 'f2-scratch': {
        if (!text.trim()) {
          return;
        }
        seq.current++;
        setContent({ kind: 'f2-progress', header: text, status: 'Translating into PromQL', showBuilding: false });
        later(800, () =>
          setContent({ kind: 'f2-progress', header: text, status: 'Building query flow', showBuilding: true })
        );
        later(1900, () => {
          const result: PopoverContent = {
            kind: 'f2-result',
            header: text,
            variant: 'updown',
            query: FLOW2.promptResult.query,
            why: FLOW2.promptResult.why,
          };
          lastResultRef.current = result;
          setContent(result);
          // Fill the editor with the proposed query, faded until accepted.
          setPreview([{ text: FLOW2.promptResult.query, proposed: true }]);
        });
        break;
      }
      case 'f3-analyze': {
        setWorkingRaw(F3_ACCEPTED);
        closePopover();
        break;
      }
      case 'f2-modify':
        closePopover();
        break;
      case 'f4-analyze': {
        const q = interpretModify4(text);
        if (q) {
          setWorkingRaw(q);
        }
        closePopover();
        break;
      }
    }
  };

  const onModifySuggestion = (s: ModifySuggestion) => {
    setWorkingRaw(s.query);
    closePopover();
  };

  // Editing the query while the pasted nudge is up dismisses it ("keep typing").
  const handleEditorChange = (next: string) => {
    setWorkingRaw(next);
    // Typing invalidates whatever was highlighted.
    setNudge(null);
    setSlashPending(false);
    if (content?.kind === 'f4-pasted' && next !== pastedValueRef.current) {
      closePopover();
    }
  };

  const onAction = (id: SubKind) => {
    setSubKind(id);
    setInputValue('');
    const map = {
      'swap-function': {
        title: 'Swap function',
        suggestions: FLOW1.swapFunction,
        tone: 'green' as const,
        placeholder: 'Describe what function you want',
      },
      'swap-metric': {
        title: 'Swap metric',
        suggestions: FLOW1.swapMetric,
        tone: 'blue' as const,
        placeholder: 'Describe what metric you want',
      },
      'change-window': {
        title: 'Change window',
        suggestions: FLOW1.changeWindow,
        tone: 'amber' as const,
        placeholder: 'Describe what window you want',
      },
    }[id];
    setContent({ kind: 'f1-sub', ...map });
  };

  const onSuggestion = (s: Suggestion) => {
    if (!sectionRef.current) {
      return;
    }
    let next = workingRaw;
    if (subKind === 'swap-function') {
      next = applySwapFunction(workingRaw, sectionRef.current, s.name);
    } else if (subKind === 'swap-metric') {
      next = applySwapMetric(workingRaw, sectionRef.current, s.name);
    } else if (subKind === 'change-window') {
      next = applyChangeWindow(workingRaw, sectionRef.current, windowValue(s.name));
    }
    setWorkingRaw(next);
    closePopover();
  };

  // Preview the highlighted swap in the query (faded) as the user hovers it.
  const onSuggestionHover = (s: Suggestion | null) => {
    const sec = sectionRef.current;
    if (!s || !subKind || !sec) {
      setPreview(null);
      return;
    }
    let start: number;
    let end: number;
    let value = s.name;
    if (subKind === 'swap-function') {
      start = sec.fn.start;
      end = sec.fn.end;
    } else if (subKind === 'swap-metric') {
      if (!sec.metric) {
        setPreview(null);
        return;
      }
      start = sec.metric.start;
      end = sec.metric.end;
    } else {
      if (!sec.range) {
        setPreview(null);
        return;
      }
      start = sec.range.start;
      end = sec.range.end;
      value = windowValue(s.name);
    }
    setPreview([
      { text: workingRaw.slice(0, start), proposed: false },
      { text: value, proposed: true },
      { text: workingRaw.slice(end), proposed: false },
    ]);
  };

  const onChip = (label: string) => {
    const chip = FLOW2.chips.find((c) => c.label === label);
    if (!chip) {
      return;
    }
    setInputValue('');
    const result: PopoverContent = {
      kind: 'f2-result',
      header: label,
      variant: 'chip',
      flowNodes: chip.flow,
      query: chip.query,
      why: chip.why,
    };
    lastResultRef.current = result;
    setContent(result);
    // Fill the editor with the chip's query, faded until accepted.
    setPreview([{ text: chip.query, proposed: true }]);
  };

  const onAccept = () => {
    if (content?.kind === 'f2-result') {
      setWorkingRaw(content.query);
    } else if (content?.kind === 'f3-analyze') {
      setWorkingRaw(F3_ACCEPTED);
    }
    closePopover();
  };

  const onModify = () => {
    setInputValue('');
    const current = content?.kind === 'f2-result' ? content.query : FLOW2.promptResult.query;
    setContent({ kind: 'f2-modify', currentQuery: current });
  };

  const onBack = () => {
    if (!content) {
      return;
    }
    setInputValue('');
    switch (content.kind) {
      case 'f1-sub':
        setSubKind(null);
        setPreview(null);
        setContent({ kind: 'f1-main', loading: false, summary: FLOW1.summary });
        break;
      case 'f2-progress':
      case 'f2-result':
        setPreview(null);
        setContent({
          kind: 'f2-scratch',
          loading: false,
          summary: FLOW2.datasourceSummary,
          chips: FLOW2.chips.map((c) => c.label),
        });
        break;
      case 'f2-modify':
        if (lastResultRef.current) {
          setContent(lastResultRef.current);
        }
        break;
      default:
        closePopover();
    }
  };

  const onExplainMore = () => {
    if (!content) {
      return;
    }
    if (content.kind === 'f3-analyze') {
      onOpenAssistant?.({ title: 'Reasoning', body: FLOW3.reasoning });
    } else if (content.kind === 'f2-scratch' || content.kind === 'f2-progress' || content.kind === 'f2-result') {
      onOpenAssistant?.({ title: 'About this datasource', body: FLOW2.explainMore });
    } else {
      onOpenAssistant?.({ title: 'Explaining this section', body: FLOW1.explainMore });
    }
  };

  const onHover = (id: 'le' | 'hq' | null) => {
    setContent((c) => (c && c.kind === 'f3-analyze' ? { ...c, hovered: id } : c));
  };

  // Esc closes the popover only — never leaves the (mock) panel editor.
  // Enter accepts on the result view (which shows the ↵ affordance but has no
  // text input of its own to catch the key).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!content) {
        if (nudge && e.key === 'Escape') {
          setNudge(null);
          setSlashPending(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closePopover();
      } else if (e.key === 'Enter' && content.kind === 'f2-result') {
        e.preventDefault();
        e.stopPropagation();
        onAccept();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, nudge]);

  // A textarea's `select` event doesn't fire when the selection *collapses*, so
  // the un-highlight case has to come from the document-level event.
  useEffect(() => {
    const onSelectionChange = () => {
      if (content || document.activeElement !== editorRef.current) {
        return;
      }
      syncSelection();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, workingRaw]);

  // Clicking anywhere that isn't the pill or the editor drops the pill.
  useEffect(() => {
    if (!nudge) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && (t.closest('[data-coauthor-nudge]') || t.closest('textarea'))) {
        return;
      }
      setNudge(null);
      setSlashPending(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [nudge]);

  // Click outside the popover closes it (like Esc).
  useEffect(() => {
    if (!content) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('[data-coauthor-popover]')) {
        return;
      }
      closePopover();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return (
    <div className={styles.card}>
      {/* Demo scenario switcher (prototype aid, not product UI) */}
      <div className={styles.scenarioBar}>
        <span className={styles.scenarioLabel}>Demo flow</span>
        {SCENARIOS.map((s) => (
          <button
            key={s.flow}
            className={cx(styles.scenarioBtn, flow === s.flow && styles.scenarioActive)}
            onClick={() => chooseScenario(s)}
          >
            {s.label}
          </button>
        ))}
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
        <div className={styles.main}>
          <div className={styles.editorRow} ref={wrapRef}>
            <span className={styles.metricsBrowser}>
              Metrics browser <Icon name="angle-right" size="sm" />
            </span>
            <div className={styles.editorArea}>
              <HighlightedQueryEditor
                value={workingRaw}
                placeholder={F2_PLACEHOLDER}
                editorRef={editorRef}
                onChange={handleEditorChange}
                onKeyDown={handleKeyDown}
                onSelect={syncSelection}
                onPaste={handlePaste}
                preview={preview}
                highlightRange={highlight}
              />
            </div>

            {nudge && !content && (
              <SelectionNudge pos={nudge} slashPending={slashPending} onClick={openHighlightFlow} />
            )}

            {content && (
              <KeyboardPopover
                pos={pos}
                content={content}
                value={inputValue}
                inputRef={inputRef}
                onInput={setInputValue}
                onSubmit={onSubmit}
                onClose={closePopover}
                onBack={onBack}
                onAction={onAction}
                onSuggestion={onSuggestion}
                onSuggestionHover={onSuggestionHover}
                onModifySuggestion={onModifySuggestion}
                onChip={onChip}
                onAccept={onAccept}
                onModify={onModify}
                onExplainMore={onExplainMore}
                onHover={onHover}
              />
            )}
          </div>

          {flow === 4 && workingRaw === '' && !content && (
            <button className={styles.pasteBtn} onClick={simulatePaste}>
              <Icon name="clipboard-alt" size="sm" /> Paste example query{' '}
              <span className={styles.pasteHint}>or press ⌘V</span>
            </button>
          )}

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
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    flex: 1,
    minWidth: 0,
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
  scenarioBtn: css({
    all: 'unset',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': { background: theme.colors.background.secondary },
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

  body: css({ display: 'flex', gap: theme.spacing(1.5), padding: theme.spacing(1.5), alignItems: 'flex-start' }),
  main: css({ flex: 1, minWidth: 0 }),
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

  pasteBtn: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    alignSelf: 'flex-start',
    marginTop: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.shape.radius.default,
    border: `1px dashed ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': { color: theme.colors.text.primary, borderColor: theme.colors.border.strong },
  }),
  pasteHint: css({ color: theme.colors.text.disabled }),
});
