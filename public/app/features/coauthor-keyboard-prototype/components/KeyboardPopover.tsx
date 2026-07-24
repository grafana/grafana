import { css, cx, keyframes } from '@emotion/css';
import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { AI_PURPLE, type FlowLiteNode, type ModifySuggestion, type Suggestion } from '../logic/flows';

import { HistogramFlow, LinearFlow, UpDownFlow } from './QueryFlowViz';

/**
 * Animates its own height to match its content, so the popover visibly expands
 * (rather than jumping) when loaded content appears. Measures the unconstrained
 * inner element, so it settles in one extra render with no loop.
 */
function AutoHeight({ children }: { children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) {
      return;
    }
    setHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div style={{ height, overflow: 'hidden', transition: 'height 0.2s ease' }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

export interface Pos {
  left: number;
  top: number;
}

export type PopoverContent =
  | { kind: 'f1-main'; loading: boolean; summary: string }
  | { kind: 'f1-sub'; title: string; suggestions: Suggestion[]; tone: 'green' | 'blue' | 'amber'; placeholder: string }
  | { kind: 'f2-scratch'; loading: boolean; summary: string; chips: string[] }
  | { kind: 'f2-progress'; header: string; status: string; showBuilding: boolean }
  | {
      kind: 'f2-result';
      header: string;
      variant: 'updown' | 'chip';
      flowNodes?: FlowLiteNode[];
      query: string;
      why: string;
    }
  | { kind: 'f2-modify'; currentQuery: string }
  | { kind: 'f3-analyze'; loading: boolean; looksLike: string; hovered: 'le' | 'hq' | null }
  | { kind: 'f4-pasted' }
  | {
      kind: 'f4-analyze';
      loading: boolean;
      looksLike: string;
      flowNodes: FlowLiteNode[];
      suggestions: ModifySuggestion[];
    };

interface Props {
  pos: Pos;
  content: PopoverContent;
  value: string;
  inputRef: RefObject<HTMLInputElement>;
  onInput: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onBack: () => void;
  onAction: (id: 'swap-function' | 'swap-metric' | 'change-window') => void;
  onSuggestion: (s: Suggestion) => void;
  onSuggestionHover: (s: Suggestion | null) => void;
  onModifySuggestion: (s: ModifySuggestion) => void;
  onChip: (label: string) => void;
  onAccept: () => void;
  onModify: () => void;
  onExplainMore: () => void;
  onHover: (id: 'le' | 'hq' | null) => void;
}

export function KeyboardPopover(props: Props) {
  const styles = useStyles2(getStyles);
  const { content, value, inputRef } = props;

  // Full-bleed input row — touches the popover edges (no surrounding padding).
  const inputRow = (placeholder: string, position: 'top' | 'bottom') => (
    <div className={cx(styles.inputRow, position === 'top' ? styles.inputTop : styles.inputBottom)}>
      <input
        ref={inputRef}
        className={styles.input}
        placeholder={placeholder}
        value={value}
        autoFocus
        onChange={(e) => props.onInput(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            props.onSubmit();
          }
        }}
      />
      <span className={styles.enter}>↵</span>
    </div>
  );

  const headerRow = (title: string) => (
    <div className={styles.headerRow}>
      <button className={styles.backBtn} onClick={props.onBack} aria-label="Back">
        <Icon name="arrow-left" size="sm" />
      </button>
      <span className={styles.headerTitle}>{title}</span>
    </div>
  );

  const loading = (label: string) => (
    <div className={styles.loading}>
      <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE }} />
      <span style={{ color: AI_PURPLE }}>{label}</span>
    </div>
  );

  const summaryRow = (text: string) => (
    <div className={styles.summaryRow}>
      <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE, flexShrink: 0, marginTop: 2 }} />
      <span className={styles.summaryText}>{text}</span>
      <button className={styles.explainMore} onClick={props.onExplainMore}>
        Explain more
      </button>
    </div>
  );

  let body: React.ReactNode = null;

  switch (content.kind) {
    case 'f1-main':
      body = (
        <>
          {inputRow('Describe what you want to change', 'top')}
          <div className={styles.bodyPad}>
            <div key={content.loading ? 'loading' : 'loaded'} className={styles.reveal}>
              {content.loading ? (
                loading('Identifying intent…')
              ) : (
                <>
                  {summaryRow(content.summary)}
                  <div className={styles.actions}>
                    <button className={styles.actionBtn} onClick={() => props.onAction('swap-function')}>
                      <Icon name="brackets-curly" size="sm" /> Swap function
                    </button>
                    <button className={styles.actionBtn} onClick={() => props.onAction('swap-metric')}>
                      <Icon name="table" size="sm" /> Swap metric
                    </button>
                    <button className={styles.actionBtn} onClick={() => props.onAction('change-window')}>
                      <Icon name="clock-nine" size="sm" /> Change window
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      );
      break;

    case 'f1-sub': {
      const toneClass =
        content.tone === 'green' ? styles.nameGreen : content.tone === 'blue' ? styles.nameBlue : styles.nameAmber;
      body = (
        <>
          {headerRow(content.title)}
          <div className={styles.bodyPad}>
            <div className={styles.subLabel}>
              Suggested {content.title.replace('Swap ', '').replace('Change ', '')}s
            </div>
            {content.suggestions.map((s) => (
              <button
                key={s.name}
                className={styles.suggestion}
                onClick={() => props.onSuggestion(s)}
                onMouseEnter={() => props.onSuggestionHover(s)}
                onMouseLeave={() => props.onSuggestionHover(null)}
              >
                <span className={cx(styles.suggName, toneClass)}>{s.name}</span>
                <span className={styles.suggDesc}>{s.desc}</span>
              </button>
            ))}
          </div>
          {inputRow(content.placeholder, 'bottom')}
        </>
      );
      break;
    }

    case 'f2-scratch':
      body = (
        <>
          {inputRow('Describe your query goal', 'top')}
          <div className={styles.bodyPad}>
            <div key={content.loading ? 'loading' : 'loaded'} className={styles.reveal}>
              {content.loading ? (
                loading('Familiarizing with datasource…')
              ) : (
                <>
                  {summaryRow(content.summary)}
                  <div className={styles.chips}>
                    {content.chips.map((c) => (
                      <button key={c} className={styles.chip} onClick={() => props.onChip(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      );
      break;

    case 'f2-progress':
      body = (
        <>
          {headerRow(content.header)}
          <div className={styles.bodyPad}>
            <div key={content.status} className={styles.reveal}>
              {loading(content.status)}
              {content.showBuilding && (
                <div className={styles.flowWrap}>
                  <UpDownFlow building />
                </div>
              )}
            </div>
          </div>
        </>
      );
      break;

    case 'f2-result':
      body = (
        <>
          {headerRow(content.header)}
          <div className={styles.bodyPad}>
            <div className={styles.subLabel}>Query flow</div>
            <div className={styles.flowWrap}>
              {content.variant === 'updown' ? (
                <UpDownFlow building={false} />
              ) : (
                <LinearFlow nodes={content.flowNodes ?? []} />
              )}
            </div>
            <div className={styles.subLabel}>Why</div>
            <div className={styles.whyRow}>
              <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE, flexShrink: 0, marginTop: 2 }} />
              <span className={styles.whyText}>{content.why}</span>
            </div>
            <div className={styles.footer}>
              <button className={styles.footerLeft} onClick={props.onModify}>
                Modify <kbd className={styles.key}>/</kbd> <kbd className={styles.key}>space</kbd>
              </button>
              <button className={styles.footerAccept} onClick={props.onAccept}>
                Accept <span className={styles.enter}>↵</span>
              </button>
            </div>
          </div>
        </>
      );
      break;

    case 'f2-modify':
      body = (
        <>
          {headerRow('Modify query')}
          <div className={styles.bodyPad}>
            <div className={styles.subLabel}>Current query</div>
            <div className={styles.queryBox}>{content.currentQuery}</div>
          </div>
          {inputRow('Describe what to change', 'bottom')}
        </>
      );
      break;

    case 'f3-analyze':
      body = (
        <>
          {inputRow('Describe your query goal', 'top')}
          <div className={styles.bodyPad}>
            <div key={content.loading ? 'loading' : 'loaded'} className={styles.reveal}>
              {content.loading ? (
                loading('Analyzing query')
              ) : (
                <>
                  <div className={styles.looksLike}>
                    <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE }} />
                    <span>
                      <span className={styles.looksItalic}>Looks like:</span> {content.looksLike}
                    </span>
                  </div>
                  <div className={styles.subLabel}>Query flow</div>
                  <div className={styles.flowWrap}>
                    <HistogramFlow hovered={content.hovered} onHover={props.onHover} />
                  </div>
                  <div className={styles.footer}>
                    <button className={styles.footerLeft} onClick={props.onExplainMore}>
                      Show reasoning
                    </button>
                    <button className={styles.footerAccept} onClick={props.onAccept}>
                      Accept 2 suggestions
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      );
      break;

    case 'f4-pasted':
      body = (
        <div className={styles.pastedBody}>
          <div className={styles.pastedTitle}>Pasted query</div>
          <div className={styles.pastedHint}>
            <kbd className={styles.key}>/</kbd> + <kbd className={styles.key}>space</kbd> to analyze and modify
          </div>
        </div>
      );
      break;

    case 'f4-analyze':
      body = (
        <>
          {inputRow('Describe your query goal', 'top')}
          <div className={styles.bodyPad}>
            <div key={content.loading ? 'loading' : 'loaded'} className={styles.reveal}>
              {content.loading ? (
                loading('Analyzing query')
              ) : (
                <>
                  <div className={styles.looksLike}>
                    <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE }} />
                    <span>
                      <span className={styles.looksItalic}>Looks like:</span> {content.looksLike}
                    </span>
                  </div>
                  <div className={styles.subLabel}>Query flow</div>
                  <div className={styles.flowWrap}>
                    <LinearFlow nodes={content.flowNodes} />
                  </div>
                  <div className={styles.subLabel}>Suggested changes</div>
                  {content.suggestions.map((s) => (
                    <button key={s.id} className={styles.card} onClick={() => props.onModifySuggestion(s)}>
                      <span className={styles.cardLabel}>{s.label}</span>
                      <span className={styles.cardTitle}>{s.title}</span>
                      <span className={styles.cardDetail}>{s.detail}</span>
                    </button>
                  ))}
                  <div className={styles.footer}>
                    <button className={styles.footerLeft} onClick={props.onExplainMore}>
                      Show reasoning
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      );
      break;
  }

  // Keyed only by `kind`: switching views replays the fade, but loading→loaded
  // within a view does NOT remount — so the prompt input keeps focus and text
  // while content loads, and only the newly revealed block animates in.
  // Visual-flow views need more room; text views stay narrow; the pasted nudge
  // is small and semi-transparent (temporary).
  const wide =
    content.kind === 'f2-result' ||
    content.kind === 'f2-progress' ||
    content.kind === 'f3-analyze' ||
    content.kind === 'f4-analyze';
  const pasted = content.kind === 'f4-pasted';
  const width = pasted ? 320 : wide ? 540 : 440;

  return (
    <div
      className={styles.popover}
      style={{
        left: props.pos.left,
        top: props.pos.top,
        width,
        ...(pasted ? { background: 'rgba(24, 27, 31, 0.82)', backdropFilter: 'blur(2px)' } : {}),
      }}
      data-coauthor-popover
    >
      <AutoHeight>
        <div key={content.kind} className={styles.animateBody}>
          {body}
        </div>
      </AutoHeight>
    </div>
  );
}

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-2px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});
const pulse = keyframes({
  '0%, 100%': { opacity: 0.55 },
  '50%': { opacity: 1 },
});

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    position: 'absolute',
    zIndex: 20,
    maxWidth: '90vw',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: 8,
    boxShadow: theme.shadows.z3,
    overflow: 'hidden',
    transition: 'width 0.2s ease',
  }),
  animateBody: css({ animation: `${fadeIn} 0.15s ease`, display: 'flex', flexDirection: 'column' }),
  // Wraps loading↔loaded content within a view; fades the revealed block in.
  reveal: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(2), animation: `${fadeIn} 0.2s ease` }),

  // Full-bleed input row — no gap to the popover edge.
  inputRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    background: theme.colors.background.canvas,
    padding: theme.spacing(1.75, 2),
  }),
  inputTop: css({ borderBottom: `1px solid ${theme.colors.border.weak}` }),
  inputBottom: css({ borderTop: `1px solid ${theme.colors.border.weak}` }),
  input: css({
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    '&::placeholder': { color: theme.colors.text.secondary },
  }),
  enter: css({ color: theme.colors.text.disabled, fontSize: theme.typography.body.fontSize }),

  headerRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  headerTitle: css({ color: theme.colors.text.primary, fontSize: theme.typography.body.fontSize }),
  backBtn: css({
    all: 'unset',
    display: 'inline-flex',
    cursor: 'pointer',
    color: theme.colors.text.secondary,
    '&:hover': { color: theme.colors.text.primary },
  }),

  bodyPad: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(2), padding: theme.spacing(2) }),

  loading: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: theme.typography.body.fontSize,
    animation: `${pulse} 1.2s ease infinite`,
  }),

  summaryRow: css({ display: 'flex', alignItems: 'flex-start', gap: theme.spacing(1) }),
  summaryText: css({
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 1.5,
  }),
  explainMore: css({
    all: 'unset',
    color: AI_PURPLE,
    fontSize: theme.typography.body.fontSize,
    cursor: 'pointer',
    flexShrink: 0,
  }),

  actions: css({ display: 'flex', gap: theme.spacing(1), flexWrap: 'wrap' }),
  actionBtn: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1.25),
    borderRadius: 6,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': { background: theme.colors.background.secondary },
  }),

  subLabel: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),

  suggestion: css({
    all: 'unset',
    display: 'block',
    cursor: 'pointer',
    // Full-width row hover: negative margin cancels the body padding so the
    // highlight spans edge-to-edge, padding keeps the text aligned.
    padding: theme.spacing(1, 2),
    margin: theme.spacing(0, -2),
    borderRadius: theme.shape.radius.default,
    '&:hover': { background: theme.colors.background.secondary },
  }),
  suggName: css({
    display: 'block',
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.body.fontSize,
  }),
  nameGreen: css({ color: theme.colors.success.text }),
  nameBlue: css({ color: theme.colors.primary.text }),
  nameAmber: css({ color: theme.colors.warning.text }),
  suggDesc: css({
    display: 'block',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: 4,
  }),

  chips: css({ display: 'flex', gap: theme.spacing(1), flexWrap: 'wrap' }),
  chip: css({
    all: 'unset',
    padding: theme.spacing(0.75, 1.25),
    borderRadius: 6,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': { background: theme.colors.background.secondary },
  }),

  flowWrap: css({ padding: theme.spacing(0.5, 0) }),
  queryBox: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,
    lineHeight: 1.6,
  }),
  whyRow: css({ display: 'flex', alignItems: 'flex-start', gap: theme.spacing(1) }),
  whyText: css({ color: theme.colors.text.primary, fontSize: theme.typography.body.fontSize, lineHeight: 1.6 }),

  footer: css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }),
  footerLeft: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
    cursor: 'pointer',
  }),
  footerAccept: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.colors.primary.text,
    fontSize: theme.typography.body.fontSize,
    cursor: 'pointer',
  }),
  key: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 11,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: 3,
    padding: '1px 5px',
  }),

  looksLike: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
  }),
  looksItalic: css({ color: AI_PURPLE, fontStyle: 'italic' }),

  // Pasted-query nudge (temporary, semi-transparent).
  pastedBody: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1), padding: theme.spacing(2) }),
  pastedTitle: css({ color: theme.colors.text.primary, fontSize: theme.typography.body.fontSize }),
  pastedHint: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),

  // Modify-suggestion card (Flow 4 analyze).
  card: css({
    all: 'unset',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    cursor: 'pointer',
    padding: theme.spacing(1, 2),
    margin: theme.spacing(0, -2),
    borderRadius: theme.shape.radius.default,
    '&:hover': { background: theme.colors.background.secondary },
  }),
  cardLabel: css({ color: AI_PURPLE, fontSize: theme.typography.bodySmall.fontSize }),
  cardTitle: css({ color: theme.colors.text.primary, fontSize: theme.typography.body.fontSize }),
  cardDetail: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.4,
  }),
});
