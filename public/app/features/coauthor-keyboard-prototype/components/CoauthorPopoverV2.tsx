import { css, cx, keyframes } from '@emotion/css';
import { type RefObject } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { AI_PURPLE, type PreviewSegment, type Suggestion } from '../logic/flows';
import { COAUTHOR_KEYS, V2_OUT_OF_SCOPE, type BuildNode, type MapNode } from '../logic/highlightV2';

import { BuildFlow, QueryMapFlow } from './HighlightV2Viz';
import { type Pos } from './KeyboardPopover';

export type V2Content =
  // Non-AI: the query map, straight away, no loading state.
  | { kind: 'map'; nodes: MapNode[] }
  // `minimal` is the MVP: prompt and explanation only, no quick-change chips.
  | { kind: 'main'; loading: boolean; looksLike: string; hasError?: boolean; minimal?: boolean }
  | { kind: 'sub'; title: string; placeholder: string; suggestions: Suggestion[]; tone: 'green' | 'amber' }
  | { kind: 'building'; prompt: string; nodes: BuildNode[] }
  // `index`/`total` place the suggestion in the run of suggestions so far, so
  // the user can page back through the conversation.
  | {
      kind: 'result';
      why: string;
      nodes: BuildNode[];
      feedback: 'up' | 'down' | null;
      index: number;
      total: number;
      /** 'mvp' drops Insert as new query and swaps the pencil for Chat. */
      actions?: 'full' | 'mvp';
    }
  // The ask needs more than this one query — hand off to Workspace instead.
  | { kind: 'out-of-scope'; feedback: 'up' | 'down' | null }
  | { kind: 'handoff' }
  | { kind: 'modify'; segments: PreviewSegment[]; index: number; total: number };

interface Props {
  pos: Pos;
  content: V2Content;
  value: string;
  inputRef: RefObject<HTMLInputElement>;
  onInput: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onStop: () => void;
  onAction: (id: 'fix-error' | 'swap-function' | 'change-window') => void;
  onSuggestion: (s: Suggestion) => void;
  onSuggestionHover: (s: Suggestion | null) => void;
  onFeedback: (v: 'up' | 'down') => void;
  onInsert: () => void;
  onEdit: () => void;
  onAccept: () => void;
  onWorkspace: () => void;
  /** Switch from the (AI-free) query map into coauthor. */
  onCoauthor: () => void;
  /** Page to an earlier / later suggestion in the same conversation. */
  onStep: (delta: -1 | 1) => void;
  /** MVP: hand the conversation to the assistant sidebar. */
  onChat?: () => void;
  /** Off in the component gallery, where several states are mounted at once. */
  autoFocus?: boolean;
}

export function CoauthorPopoverV2(props: Props) {
  const styles = useStyles2(getStyles);
  const { content, value, inputRef, autoFocus = true } = props;

  const inputRow = (placeholder: string, position: 'top' | 'bottom') => (
    <div className={cx(styles.inputRow, position === 'top' ? styles.inputTop : styles.inputBottom)}>
      <input
        ref={inputRef}
        className={styles.input}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
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

  // Shared by the suggestion and out-of-scope cards. Plain buttons + Tooltip:
  // IconButton would force the tooltip text to double as the aria-label, losing
  // which thumb is which.
  const thumbsRow = (feedback: 'up' | 'down' | null) => (
    <span className={styles.thumbs}>
      <Tooltip content="Give feedback">
        <button
          className={cx(styles.thumb, feedback === 'up' && styles.thumbActive)}
          aria-label="Good suggestion"
          onClick={() => props.onFeedback('up')}
        >
          <Icon name="thumbs-up" size="md" />
        </button>
      </Tooltip>
      <Tooltip content="Give feedback">
        <button
          className={cx(styles.thumb, feedback === 'down' && styles.thumbActive)}
          aria-label="Bad suggestion"
          onClick={() => props.onFeedback('down')}
        >
          <Icon name="thumbs-down" size="md" />
        </button>
      </Tooltip>
    </span>
  );

  let body: React.ReactNode = null;

  switch (content.kind) {
    case 'map':
      body = (
        <>
          <div className={styles.bodyPad}>
            <div className={styles.subLabel}>Query map</div>
            <QueryMapFlow nodes={content.nodes} />
          </div>
          {/* The map itself is AI-free; this is the opt-in into coauthor. */}
          <div className={styles.mapFooter}>
            <button className={styles.mapCoauthor} onClick={props.onCoauthor}>
              <Icon name="ai-sparkle" size="sm" />
              <span className={styles.mapCoauthorStrong}>Explain</span>
              <span className={styles.mapCoauthorSoft}>or modify</span>
            </button>
            <span className={styles.mapKeys}>{COAUTHOR_KEYS.join(' + ')}</span>
          </div>
        </>
      );
      break;

    case 'main':
      body = (
        <>
          {inputRow('Describe a quick change...', 'top')}
          <div className={styles.bodyPad}>
            <div key={content.loading ? 'loading' : 'loaded'} className={styles.reveal}>
              {content.loading ? (
                <div className={styles.loading}>
                  <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE }} />
                  <span style={{ color: AI_PURPLE }}>Identifying intent…</span>
                </div>
              ) : (
                <>
                  {/* The MVP offers the prompt and the explanation, nothing else. */}
                  {!content.minimal && (
                    <div className={styles.actions}>
                      {/* Only offered when something in the query can't resolve. */}
                      {content.hasError && (
                        <button
                          className={cx(styles.actionBtn, styles.actionFix)}
                          onClick={() => props.onAction('fix-error')}
                        >
                          <Icon name="exclamation-triangle" size="sm" /> Fix error
                        </button>
                      )}
                      <button className={styles.actionBtn} onClick={() => props.onAction('swap-function')}>
                        <Icon name="brackets-curly" size="sm" /> Swap function
                      </button>
                      <button className={styles.actionBtn} onClick={() => props.onAction('change-window')}>
                        <Icon name="clock-nine" size="sm" /> Change window
                      </button>
                    </div>
                  )}
                  <div className={styles.looksLike}>
                    <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE, flexShrink: 0, marginTop: 3 }} />
                    <span>
                      <span className={styles.looksItalic}>Looks like:</span> {content.looksLike}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      );
      break;

    case 'sub':
      body = (
        <>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={props.onBack} aria-label="Back">
              <Icon name="arrow-left" size="sm" />
            </button>
            <span className={styles.headerTitle}>{content.title}</span>
          </div>
          <div className={styles.bodyPad}>
            {content.suggestions.map((s) => (
              <button
                key={s.name}
                className={styles.suggestion}
                onClick={() => props.onSuggestion(s)}
                onMouseEnter={() => props.onSuggestionHover(s)}
                onMouseLeave={() => props.onSuggestionHover(null)}
              >
                <span className={cx(styles.suggName, content.tone === 'green' ? styles.nameGreen : styles.nameAmber)}>
                  {s.name}
                </span>
                <span className={styles.suggDesc}>{s.desc}</span>
              </button>
            ))}
          </div>
          {inputRow(content.placeholder, 'bottom')}
        </>
      );
      break;

    case 'building':
      body = (
        <>
          <div className={cx(styles.inputRow, styles.inputTop)}>
            <span className={styles.promptEcho}>{content.prompt}</span>
            <button className={styles.stop} onClick={props.onStop} aria-label="Stop" title="Stop">
              <Icon name="square-shape" size="sm" />
            </button>
          </div>
          <div className={styles.bodyPad}>
            <div className={styles.loading}>
              <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE }} />
              <span style={{ color: AI_PURPLE }}>Building query flow</span>
            </div>
            <BuildFlow nodes={content.nodes} />
          </div>
        </>
      );
      break;

    case 'result': {
      const suggestion = (
        <>
          <div className={styles.subLabel}>Why</div>
          <div className={styles.whyRow}>
            <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE, flexShrink: 0, marginTop: 3 }} />
            <span className={styles.whyText}>{content.why}</span>
          </div>
          <BuildFlow nodes={content.nodes} />
        </>
      );
      // A lone suggestion needs no box or count — those only earn their keep
      // once there's more than one to page between.
      const paged = content.total > 1;
      body = (
        <div className={styles.bodyPad}>
          {paged ? <div className={styles.suggestionBox}>{suggestion}</div> : suggestion}

          {paged && (
            <div className={styles.pager}>
              <button
                className={cx(styles.pagerArrow, content.index === 0 && styles.pagerArrowOff)}
                onClick={() => props.onStep(-1)}
                disabled={content.index === 0}
                aria-label="Previous suggestion"
              >
                <Icon name="angle-left" size="sm" />
              </button>
              <span className={styles.pagerLabel}>
                {content.index + 1} of {content.total}
              </span>
              <button
                className={cx(styles.pagerArrow, content.index === content.total - 1 && styles.pagerArrowOff)}
                onClick={() => props.onStep(1)}
                disabled={content.index === content.total - 1}
                aria-label="Next suggestion"
              >
                <Icon name="angle-right" size="sm" />
              </button>
            </div>
          )}

          <div className={styles.footer}>
            {thumbsRow(content.feedback)}
            {content.actions === 'mvp' ? (
              // MVP: accept it, or take the conversation to the assistant.
              <span className={styles.footerRight}>
                <button className={styles.footerAction} onClick={props.onChat}>
                  <Icon name="comment-alt" size="sm" /> Chat
                </button>
                <button className={styles.footerAccept} onClick={props.onAccept}>
                  <Icon name="check" size="sm" /> Accept
                </button>
              </span>
            ) : (
              <span className={styles.footerRight}>
                <button className={styles.footerAction} onClick={props.onInsert}>
                  <Icon name="list-ul" size="sm" /> Insert as new query
                </button>
                <button className={styles.footerIcon} onClick={props.onEdit} aria-label="Modify suggestion">
                  <Icon name="pen" size="sm" />
                </button>
                <button className={styles.footerAccept} onClick={props.onAccept}>
                  <Icon name="check" size="sm" /> Accept
                </button>
              </span>
            )}
          </div>
        </div>
      );
      break;
    }

    case 'out-of-scope':
      body = (
        <div className={styles.bodyPad}>
          <div className={styles.whyRow}>
            <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE, flexShrink: 0, marginTop: 3 }} />
            <span className={styles.whyText}>{V2_OUT_OF_SCOPE.body}</span>
          </div>
          <div className={styles.note}>{V2_OUT_OF_SCOPE.note}</div>
          <div className={styles.footer}>
            {thumbsRow(content.feedback)}
            <span className={styles.footerRight}>
              <button className={styles.footerIcon} onClick={props.onEdit} aria-label="Modify request">
                <Icon name="pen" size="sm" />
              </button>
              <button className={styles.workspaceBtn} onClick={props.onWorkspace}>
                {/* The label is gradient-filled text, so the icon needs its own
                    color — currentColor is transparent inside the clip. */}
                <Icon name="ai-sparkle" size="sm" style={{ color: GRADIENT_START }} />
                <span className={styles.workspaceText}>Continue in Workspace</span>
              </button>
            </span>
          </div>
        </div>
      );
      break;

    case 'handoff':
      body = (
        <div className={styles.bodyPad}>
          <div className={styles.loading}>
            <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE }} />
            <span style={{ color: AI_PURPLE }}>Opening in Workspace…</span>
          </div>
        </div>
      );
      break;

    case 'modify':
      body = (
        <>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={props.onBack} aria-label="Back">
              <Icon name="arrow-left" size="sm" />
            </button>
            <span className={styles.headerTitle}>Modify suggestion</span>
          </div>
          <div className={styles.bodyPad}>
            {/* The whole query as it stands, pending edits included, so the next
                prompt is clearly building on this one. */}
            <div className={styles.queryBox}>
              {content.segments.map((seg, i) => (
                <span key={i} className={seg.proposed ? styles.queryPending : undefined}>
                  {seg.text}
                </span>
              ))}
            </div>
            {/* The count only earns its keep once there's more than one
                suggestion to place yourself among. */}
            {content.total > 1 && (
              <div className={styles.pager}>
                <span className={styles.pagerLabel}>
                  {content.index + 1} of {content.total}
                </span>
              </div>
            )}
          </div>
          {inputRow('What do you want to update?', 'bottom')}
        </>
      );
      break;
  }

  const width =
    content.kind === 'map'
      ? 700
      : content.kind === 'building' || content.kind === 'result' || content.kind === 'out-of-scope'
        ? 520
        : content.kind === 'sub' || content.kind === 'modify'
          ? 460
          : 380;

  return (
    <div className={styles.popover} style={{ left: props.pos.left, top: props.pos.top, width }} data-coauthor-popover>
      <div key={content.kind} className={styles.animateBody}>
        {body}
      </div>
    </div>
  );
}

// Warm-to-cool AI gradient for the Workspace hand-off label.
const GRADIENT_START = '#f0a05a';
const GRADIENT = `linear-gradient(90deg, ${GRADIENT_START} 0%, #d187f5 28%, #7b61ff 58%, #e0568f 100%)`;

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
  reveal: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(2), animation: `${fadeIn} 0.2s ease` }),

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
  // The submitted prompt stays visible while the suggestion is generated.
  promptEcho: css({ flex: 1, color: theme.colors.text.secondary, fontSize: theme.typography.body.fontSize }),
  stop: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 4,
    border: `1px solid ${theme.colors.border.strong}`,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    '&:hover': { background: theme.colors.background.secondary },
  }),

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

  mapFooter: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.canvas,
  }),
  mapCoauthor: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: AI_PURPLE,
    fontSize: theme.typography.body.fontSize,
    cursor: 'pointer',
    '&:hover span': { opacity: 1 },
  }),
  mapCoauthorStrong: css({ color: AI_PURPLE }),
  mapCoauthorSoft: css({ color: AI_PURPLE, opacity: 0.65 }),
  mapKeys: css({ color: theme.colors.text.disabled, fontSize: theme.typography.bodySmall.fontSize }),
  subLabel: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),

  loading: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: theme.typography.body.fontSize,
    animation: `${pulse} 1.2s ease infinite`,
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
  actionFix: css({
    color: theme.colors.error.text,
    borderColor: theme.colors.error.border,
  }),

  looksLike: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 1.5,
  }),
  looksItalic: css({ color: AI_PURPLE, fontStyle: 'italic' }),

  suggestion: css({
    all: 'unset',
    display: 'block',
    cursor: 'pointer',
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
  nameAmber: css({ color: theme.colors.warning.text }),
  suggDesc: css({
    display: 'block',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: 4,
  }),

  suggestionBox: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    margin: theme.spacing(-1, -1, 0),
    borderRadius: 6,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  pager: css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: theme.spacing(1) }),
  pagerLabel: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
  pagerArrow: css({
    all: 'unset',
    display: 'inline-flex',
    color: theme.colors.text.link,
    cursor: 'pointer',
    '&:hover': { color: theme.colors.text.primary },
  }),
  pagerArrowOff: css({ color: theme.colors.text.disabled, cursor: 'default' }),
  queryBox: css({
    padding: theme.spacing(1.5),
    borderRadius: 6,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.7,
    color: theme.colors.text.primary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  queryPending: css({ color: theme.colors.primary.text }),
  whyRow: css({ display: 'flex', alignItems: 'flex-start', gap: theme.spacing(1) }),
  note: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  workspaceBtn: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    // Padding makes the hover a pill; the negative margin keeps the label where
    // it sat before.
    padding: theme.spacing(0.5, 1),
    margin: theme.spacing(-0.5, -1),
    borderRadius: 4,
    fontSize: theme.typography.body.fontSize,
    cursor: 'pointer',
    transition: 'background 0.15s ease, filter 0.15s ease',
    '&:hover': { background: 'rgba(255, 255, 255, 0.07)', filter: 'brightness(1.12)' },
  }),
  workspaceText: css({
    backgroundImage: GRADIENT,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  }),
  whyText: css({ color: theme.colors.text.primary, fontSize: theme.typography.body.fontSize, lineHeight: 1.6 }),

  footer: css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }),
  thumbs: css({ display: 'inline-flex', gap: theme.spacing(1) }),
  thumb: css({
    all: 'unset',
    display: 'inline-flex',
    padding: 2,
    borderRadius: 4,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    '&:hover': { color: theme.colors.text.primary, background: theme.colors.background.secondary },
  }),
  thumbActive: css({ color: theme.colors.primary.text }),
  footerRight: css({ display: 'inline-flex', alignItems: 'center', gap: theme.spacing(2) }),
  footerAction: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
    cursor: 'pointer',
    '&:hover': { color: theme.colors.text.primary },
  }),
  footerIcon: css({
    all: 'unset',
    display: 'inline-flex',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    '&:hover': { color: theme.colors.text.primary },
  }),
  footerAccept: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    // Padding makes the hover a pill; the negative margin keeps the button where
    // it sat before.
    padding: theme.spacing(0.5, 1),
    margin: theme.spacing(-0.5, -1),
    borderRadius: 4,
    color: theme.colors.primary.text,
    fontSize: theme.typography.body.fontSize,
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
    '&:hover': { background: 'rgba(110, 159, 255, 0.18)', color: theme.colors.text.maxContrast },
  }),
});
