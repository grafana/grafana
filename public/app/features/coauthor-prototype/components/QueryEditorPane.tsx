import { css, cx } from '@emotion/css';
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, IconButton, Input, Spinner, Tooltip, useStyles2 } from '@grafana/ui';

import { getCaretCoordinates } from '../logic/caret';
import {
  BASE_QUERY,
  MOCK_DATASOURCE,
  commandSuggestions,
  detectManualEdit,
  explainSelection,
  interpretModify,
  snapRange,
  suggestionsFor,
  understand,
  type Chip,
  type CommandSuggestion,
  type ModifyResult,
} from '../logic/queryModel';

import { ExplainPanel } from './ExplainPanel';

type ChangeSource = 'nl' | 'manual' | null;

interface Pos {
  left: number;
  top: number;
}

interface Selection {
  chips: Chip[];
  start: number;
  end: number;
  pos: Pos;
}

interface Props {
  coauthorOn: boolean;
  setCoauthorOn: Dispatch<SetStateAction<boolean>>;
}

/** Turn a suggestion into the natural-language request it stands for. */
function suggestionRequest(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('p95') || t.includes('percentile')) {
    return 'use p95 instead of average';
  }
  if (t.includes('error') || t.includes('failed')) {
    return 'only failed requests';
  }
  return 'only checkout-service';
}

export function QueryEditorPane({ coauthorOn, setCoauthorOn }: Props) {
  const styles = useStyles2(getStyles);

  const [committedRaw, setCommittedRaw] = useState(BASE_QUERY);
  const [workingRaw, setWorkingRaw] = useState(BASE_QUERY);
  const [history, setHistory] = useState<string[]>([BASE_QUERY]);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [commandPos, setCommandPos] = useState<Pos | null>(null);
  const [commandEvaluating, setCommandEvaluating] = useState(false);

  const [modifyText, setModifyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ModifyResult | null>(null);
  const [changeSource, setChangeSource] = useState<ChangeSource>(null);
  const [manualDetection, setManualDetection] = useState<{ summary: string; suggestion: string } | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);

  const understanding = useMemo(() => understand(workingRaw), [workingRaw]);
  const baseline = useMemo(() => understand(committedRaw), [committedRaw]);

  const pending = workingRaw !== committedRaw;
  const focus = selection ? { label: 'SELECTED SECTION', explanation: explainSelection(selection.chips) } : null;

  // Suggestions for a highlighted span, each with a precomputed result.
  const selectionSuggestions = useMemo<CommandSuggestion[]>(
    () =>
      suggestionsFor(selection ? selection.chips : null).map((s) => ({
        ...s,
        result: interpretModify(suggestionRequest(s.title), workingRaw),
      })),
    [selection, workingRaw]
  );

  const closePopover = () => {
    setSelection(null);
    setCommandPos(null);
    setCommandEvaluating(false);
    setModifyText('');
  };

  // Keyboard: cmd/ctrl + / toggles coauthor; Escape closes popover / exits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setCoauthorOn((v) => !v);
      } else if (e.key === 'Escape') {
        if (selection || commandPos) {
          closePopover();
        } else if (coauthorOn) {
          setCoauthorOn(false);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, commandPos, coauthorOn]);

  const clampLeft = (left: number) => {
    const width = editorWrapRef.current?.clientWidth ?? 500;
    return Math.max(4, Math.min(left, width - 330));
  };

  // Highlight → adapt the explanation + open the explain/modify popover.
  const handleSelect = () => {
    const ta = editorRef.current;
    if (!ta) {
      return;
    }
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    if (s === e) {
      setSelection(null);
      return;
    }
    const snap = snapRange(workingRaw, s, e);
    if (!snap.chips.length) {
      setSelection(null);
      return;
    }
    const coords = getCaretCoordinates(ta, snap.end);
    setCommandPos(null);
    setSelection({
      chips: snap.chips,
      start: snap.start,
      end: snap.end,
      pos: { left: clampLeft(coords.left), top: coords.top + coords.height + 4 },
    });
  };

  // "/" + space anywhere in the editor → inline natural-language help at caret.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === ' ') {
      const ta = e.currentTarget;
      const pos = ta.selectionStart;
      if (workingRaw[pos - 1] === '/') {
        e.preventDefault();
        const next = workingRaw.slice(0, pos - 1) + workingRaw.slice(pos);
        setWorkingRaw(next);
        setChangeSource('manual');
        const coords = getCaretCoordinates(ta, pos - 1);
        openCommandAt({ left: clampLeft(coords.left), top: coords.top + coords.height + 4 });
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.currentTarget.value;
    const wasPending = workingRaw !== committedRaw;
    setWorkingRaw(next);
    setChangeSource('manual');
    setLastResult(null);
    setManualDetection(detectManualEdit(committedRaw, next));
    // Surface the diff automatically the first time the query diverges.
    if (!wasPending && next !== committedRaw) {
      setShowDiff(true);
    }
  };

  const applyResult = (result: ModifyResult) => {
    setLoading(true);
    window.setTimeout(() => {
      setLastResult(result);
      setChangeSource('nl');
      setManualDetection(null);
      if (result.kind !== 'unknown') {
        setWorkingRaw(result.newRaw);
        setShowDiff(true);
      }
      setLoading(false);
      closePopover();
    }, 900);
  };

  const runModifyText = (text: string) => {
    if (!text.trim()) {
      return;
    }
    applyResult(interpretModify(text, workingRaw));
  };

  const acceptChange = () => {
    setCommittedRaw(workingRaw);
    setHistory((h) => (h[h.length - 1] === workingRaw ? h : [...h, workingRaw]));
    setLastResult(null);
    setManualDetection(null);
    setChangeSource(null);
    setShowDiff(false);
    closePopover();
  };

  const discardChange = () => {
    setWorkingRaw(committedRaw);
    setLastResult(null);
    setManualDetection(null);
    setChangeSource(null);
    setShowDiff(false);
    closePopover();
  };

  const revertTo = (index: number) => {
    const raw = history[index];
    setCommittedRaw(raw);
    setWorkingRaw(raw);
    setHistory((h) => h.slice(0, index + 1));
    setLastResult(null);
    setManualDetection(null);
    setChangeSource(null);
    setShowDiff(false);
    closePopover();
  };

  // Opening the command popover kicks off a short "evaluating the query" state
  // before the contextual suggestions and NL input appear.
  const openCommandAt = (pos: Pos) => {
    setSelection(null);
    setCommandPos(pos);
    setCommandEvaluating(true);
    window.setTimeout(() => setCommandEvaluating(false), 900);
  };

  const openCommand = () => {
    const ta = editorRef.current;
    const coords = ta ? getCaretCoordinates(ta, ta.value.length) : { left: 4, top: 0, height: 18 };
    openCommandAt({ left: clampLeft(coords.left), top: coords.top + coords.height + 4 });
  };

  // ---- Coauthor OFF: classic-looking code editor -------------------------
  const classicBody = (
    <div className={styles.classic}>
      <div className={styles.metricsRow}>
        <span className={styles.metricsBrowser}>
          <Icon name="search" size="sm" /> Metrics browser
          <Icon name="angle-right" size="sm" />
        </span>
        <code className={styles.classicCode}>{committedRaw}</code>
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
  );

  // ---- Coauthor ON -------------------------------------------------------
  const coauthorBody = (
    <div className={styles.coauthorLayout}>
      <div className={styles.coauthorMain}>
        <div className={styles.tabs}>
          <button className={styles.tabActive} onClick={() => setCoauthorOn(false)}>
            <Icon name="ai-sparkle" size="sm" /> Coauthor <kbd className={styles.kbd}>cmd + esc</kbd>
          </button>
          <button className={styles.tab} onClick={openCommand}>
            Modify query
          </button>
          <button className={styles.tab} onClick={closePopover}>
            Explain
          </button>
        </div>

        {/* Editable query editor (source of truth) */}
        <div className={styles.editorWrap} ref={editorWrapRef}>
          <textarea
            ref={editorRef}
            className={styles.editor}
            value={workingRaw}
            spellCheck={false}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onBlur={() => {
              // keep popover if the focus moved into it; otherwise a click elsewhere clears
            }}
          />

          {selection && (
            <CoauthorPopover
              title="Selected section"
              explanation={explainSelection(selection.chips)}
              placeholder="Describe a change to this part"
              suggestions={selectionSuggestions}
              value={modifyText}
              loading={loading}
              evaluating={false}
              pos={selection.pos}
              onChange={setModifyText}
              onSubmit={() => runModifyText(modifyText)}
              onApply={applyResult}
              onClose={closePopover}
            />
          )}

          {commandPos && (
            <CoauthorPopover
              title="Coauthor"
              placeholder="Ask for help with your query…"
              suggestions={commandSuggestions(workingRaw)}
              value={modifyText}
              loading={loading}
              evaluating={commandEvaluating}
              pos={commandPos}
              onChange={setModifyText}
              onSubmit={() => runModifyText(modifyText)}
              onApply={applyResult}
              onClose={closePopover}
            />
          )}
        </div>

        {!pending && (
          <div className={styles.pills}>
            <span className={styles.pill}>highlight a section to explain or modify it</span>
            <span className={styles.pill}>
              type <kbd className={styles.kbd}>/</kbd> then space for inline help
            </span>
            <span className={styles.pill}>keep typing to modify</span>
          </div>
        )}

        {pending && (
          <div className={styles.pendingBar}>
            <div className={styles.pendingInfo}>
              {changeSource === 'nl' && lastResult && (
                <span className={styles.confidence}>
                  <Icon name="ai-sparkle" size="sm" /> {lastResult.confidence}% match
                  <Tooltip content="How closely this matches what you asked for — not a measure of whether the query is correct or efficient.">
                    <Icon name="info-circle" size="sm" className={styles.infoIcon} />
                  </Tooltip>
                </span>
              )}
              {changeSource === 'manual' && manualDetection && (
                <span className={styles.detected}>
                  <Icon name="exclamation-triangle" size="sm" /> {manualDetection.summary}
                </span>
              )}
              <span className={styles.note}>
                {changeSource === 'nl' ? lastResult?.note : manualDetection?.suggestion}
              </span>
            </div>
            <div className={styles.pendingActions}>
              <Button size="sm" variant="secondary" fill="outline" onClick={() => setShowDiff((v) => !v)}>
                {showDiff ? 'Hide diff' : 'Show diff'}
              </Button>
              <Button size="sm" variant="secondary" onClick={discardChange}>
                Iterate / discard
              </Button>
              <Button size="sm" onClick={acceptChange}>
                Accept
              </Button>
            </div>
          </div>
        )}

        {history.length > 1 && (
          <div className={styles.history}>
            <span className={styles.historyLabel}>Accepted:</span>
            {history.map((h, i) => (
              <button
                key={i}
                className={cx(styles.historyItem, h === committedRaw && !pending && styles.historyActive)}
                title={h}
                onClick={() => revertTo(i)}
              >
                {i === 0 ? 'original' : `step ${i}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <ExplainPanel
        understanding={understanding}
        baseline={baseline}
        showDiff={showDiff}
        canDiff={pending}
        onToggleDiff={setShowDiff}
        focus={focus}
      />
    </div>
  );

  return (
    <div className={styles.card}>
      {/* Datasource row */}
      <div className={styles.dsRow}>
        <Icon name="database" size="sm" />
        <span className={styles.dsName}>{MOCK_DATASOURCE.name}</span>
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

      {/* Editor toolbar */}
      <div className={styles.toolbar}>
        {!coauthorOn && (
          <>
            <Button size="sm" variant="secondary" fill="outline" icon="ai-sparkle" onClick={() => setCoauthorOn(true)}>
              Coauthor <kbd className={styles.kbdBtn}>cmd + /</kbd>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCoauthorOn(true)}>
              Kick start your query
            </Button>
            <span className={styles.explainToggle}>
              Explain
              <button className={styles.switch} onClick={() => setCoauthorOn(true)} aria-label="Toggle explain">
                <span className={styles.switchKnob} style={{ left: 1 }} />
              </button>
            </span>
          </>
        )}
        <span className={styles.spacer} />
        <Button size="sm" variant="secondary">
          Run queries
        </Button>
        <div className={styles.modeToggle}>
          <span className={styles.modeItem}>Builder</span>
          <span className={styles.modeActive}>Code</span>
        </div>
      </div>

      <div className={styles.body}>{coauthorOn ? coauthorBody : classicBody}</div>
    </div>
  );
}

// --- Explain + modify popover ---------------------------------------------
interface PopoverProps {
  title: string;
  explanation?: string;
  placeholder: string;
  suggestions: CommandSuggestion[];
  value: string;
  loading: boolean;
  evaluating: boolean;
  pos: Pos;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onApply: (result: ModifyResult) => void;
  onClose: () => void;
}

function CoauthorPopover({
  title,
  explanation,
  placeholder,
  suggestions,
  value,
  loading,
  evaluating,
  pos,
  onChange,
  onSubmit,
  onApply,
  onClose,
}: PopoverProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.popover} style={{ left: pos.left, top: pos.top }}>
      <div className={styles.popHeader}>
        <span>{title}</span>
        <IconButton name="times" size="sm" aria-label="Close" onClick={onClose} tooltip="Close" />
      </div>

      {evaluating ? (
        <div className={styles.loading}>
          <Spinner size="sm" /> Evaluating your query…
        </div>
      ) : (
        <>
          {explanation && <p className={styles.popExplain}>{explanation}</p>}

          {loading ? (
            <div className={styles.loading}>
              <Spinner size="sm" /> Reasoning through the new query…
            </div>
          ) : (
            <Input
              autoFocus
              prefix={<Icon name="ai-sparkle" size="sm" />}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSubmit();
                }
              }}
            />
          )}

          <div className={styles.popSuggestionsLabel}>{suggestions.length} suggestions</div>
          {suggestions.map((s, i) => (
            <button key={i} className={styles.suggestion} onClick={() => onApply(s.result)} disabled={loading}>
              <span className={styles.suggLabel}>{s.label}</span>
              <span className={styles.suggTitle}>{s.title}</span>
              <span className={styles.suggDetail}>{s.detail}</span>
            </button>
          ))}
        </>
      )}
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
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    minHeight: 48,
  }),
  spacer: css({ flex: 1 }),
  explainToggle: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  switch: css({
    width: 32,
    height: 18,
    borderRadius: 9,
    border: `1px solid ${theme.colors.border.medium}`,
    background: theme.colors.background.secondary,
    position: 'relative',
    cursor: 'pointer',
    padding: 0,
  }),
  switchKnob: css({
    position: 'absolute',
    top: 1,
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: theme.colors.text.primary,
  }),
  modeToggle: css({
    display: 'inline-flex',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  modeItem: css({
    padding: theme.spacing(0.25, 1),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  modeActive: css({
    padding: theme.spacing(0.25, 1),
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  body: css({ padding: theme.spacing(1.5) }),

  // classic
  classic: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1) }),
  metricsRow: css({
    display: 'flex',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.canvas,
  }),
  metricsBrowser: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
  }),
  classicCode: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    whiteSpace: 'pre-wrap',
  }),
  fetchHint: css({
    display: 'flex',
    gap: theme.spacing(1),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(1),
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
  }),
  optionMeta: css({ color: theme.colors.text.disabled }),

  // coauthor
  coauthorLayout: css({ display: 'flex', gap: theme.spacing(1.5), alignItems: 'flex-start' }),
  coauthorMain: css({ flex: 1, minWidth: 0 }),
  tabs: css({ display: 'flex', gap: theme.spacing(0.5), marginBottom: theme.spacing(1.5) }),
  tab: css({
    all: 'unset',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': { background: theme.colors.background.secondary },
  }),
  tabActive: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.default,
    background: 'rgba(110, 159, 255, 0.15)',
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
  }),
  kbd: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 10,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: 3,
    padding: '0 4px',
  }),
  kbdBtn: css({ fontSize: 10, opacity: 0.8, marginLeft: 4 }),

  editorWrap: css({ position: 'relative', marginBottom: theme.spacing(1) }),
  editor: css({
    width: '100%',
    minHeight: 88,
    resize: 'vertical',
    boxSizing: 'border-box',
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.canvas,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.6,
    outline: 'none',
    '&:focus': { borderColor: theme.colors.primary.border },
  }),

  pills: css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing(0.75) }),
  pill: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),

  // pending
  pendingBar: css({
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    border: `1px solid ${theme.colors.primary.border}`,
    borderRadius: theme.shape.radius.default,
    background: 'rgba(110, 159, 255, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),
  pendingInfo: css({ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }),
  confidence: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: theme.colors.primary.text,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  detected: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: theme.colors.warning.text,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  infoIcon: css({ color: theme.colors.text.secondary, cursor: 'help' }),
  note: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
  pendingActions: css({ display: 'flex', gap: theme.spacing(1), flexShrink: 0 }),

  // history
  history: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(0.5), marginTop: theme.spacing(1) }),
  historyLabel: css({ color: theme.colors.text.disabled, fontSize: theme.typography.bodySmall.fontSize }),
  historyItem: css({
    all: 'unset',
    padding: theme.spacing(0, 0.75),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': { borderColor: theme.colors.border.strong },
  }),
  historyActive: css({ borderColor: theme.colors.primary.border, color: theme.colors.primary.text }),

  // popover
  popover: css({
    position: 'absolute',
    zIndex: 10,
    width: 320,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    padding: theme.spacing(1.5),
  }),
  popHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginBottom: theme.spacing(0.5),
  }),
  popExplain: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    margin: theme.spacing(0, 0, 1),
    lineHeight: 1.4,
  }),
  loading: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(1, 0),
  }),
  popSuggestionsLabel: css({
    color: theme.colors.text.disabled,
    fontSize: theme.typography.bodySmall.fontSize,
    margin: theme.spacing(1.5, 0, 0.5),
  }),
  suggestion: css({
    all: 'unset',
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    cursor: 'pointer',
    '&:hover': { borderColor: theme.colors.primary.border, background: theme.colors.background.primary },
  }),
  suggLabel: css({ display: 'block', color: theme.colors.primary.text, fontSize: 11, marginBottom: 2 }),
  suggTitle: css({ display: 'block', color: theme.colors.text.primary, fontSize: theme.typography.bodySmall.fontSize }),
  suggDetail: css({
    display: 'block',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
