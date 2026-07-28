import { css, cx } from '@emotion/css';
import { type RefObject, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type PreviewSegment } from '../logic/flows';
import { highlightSegments } from '../logic/tokens';

interface Props {
  value: string;
  placeholder: string;
  editorRef: RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMouseDown?: () => void;
  onSelect?: () => void;
  onPaste?: () => void;
  /** When set, the backdrop shows this proposed query (proposed spans faded)
   * instead of the committed value. */
  preview?: PreviewSegment[] | null;
  /** When set (and no preview), paints a persistent selection highlight over
   * this char range, so it's clear which section a popover refers to. */
  highlightRange?: { start: number; end: number } | null;
  /** Char range to underline with a red squiggle (an unresolvable token). */
  errorRange?: { start: number; end: number } | null;
}

/**
 * A lightweight PromQL editor: a transparent <textarea> layered over a backdrop
 * that renders the same text with metric names highlighted. Native selection
 * and caret come from the textarea; color comes from the backdrop.
 */
export function HighlightedQueryEditor({
  value,
  placeholder,
  editorRef,
  onChange,
  onKeyDown,
  onKeyUp,
  onMouseDown,
  onSelect,
  onPaste,
  preview,
  highlightRange,
  errorRange,
}: Props) {
  const styles = useStyles2(getStyles);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Render a committed run with metric names highlighted, squiggling whatever
  // part of it falls inside the error range. `offset` is the run's position in
  // the full text, since the range is absolute.
  const renderReal = (text: string, keyPrefix: string, offset = 0) => {
    const out: React.ReactNode[] = [];
    let pos = offset;
    highlightSegments(text).forEach((seg, i) => {
      const start = pos;
      const end = pos + seg.text.length;
      pos = end;
      const cls = seg.metric ? styles.metric : undefined;
      if (!errorRange || errorRange.end <= start || errorRange.start >= end) {
        out.push(
          <span key={`${keyPrefix}-${i}`} className={cls}>
            {seg.text}
          </span>
        );
        return;
      }
      const from = Math.max(start, errorRange.start) - start;
      const to = Math.min(end, errorRange.end) - start;
      if (from > 0) {
        out.push(
          <span key={`${keyPrefix}-${i}-pre`} className={cls}>
            {seg.text.slice(0, from)}
          </span>
        );
      }
      out.push(
        <span key={`${keyPrefix}-${i}-err`} className={cx(cls, styles.error)}>
          {seg.text.slice(from, to)}
        </span>
      );
      if (to < seg.text.length) {
        out.push(
          <span key={`${keyPrefix}-${i}-post`} className={cls}>
            {seg.text.slice(to)}
          </span>
        );
      }
    });
    return out;
  };

  let backdrop: React.ReactNode;
  if (preview) {
    let offset = 0;
    backdrop = preview.map((seg, i) => {
      const start = offset;
      offset += seg.text.length;
      return seg.proposed ? (
        <span key={i} className={seg.tone === 'blue' ? styles.proposedBlue : styles.proposed}>
          {seg.text}
        </span>
      ) : (
        <span key={i}>{renderReal(seg.text, `p${i}`, start)}</span>
      );
    });
  } else if (highlightRange && value) {
    const { start, end } = highlightRange;
    backdrop = (
      <>
        {renderReal(value.slice(0, start), 'b')}
        <span className={styles.highlight}>{renderReal(value.slice(start, end), 'h', start)}</span>
        {renderReal(value.slice(end), 'a', end)}
      </>
    );
  } else if (value) {
    backdrop = renderReal(value, 'v');
  } else {
    backdrop = <span className={styles.placeholder}>{placeholder}</span>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.backdrop} aria-hidden ref={backdropRef}>
        {backdrop}
      </div>
      <textarea
        ref={editorRef}
        className={styles.textarea}
        value={value}
        spellCheck={false}
        rows={2}
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onMouseDown={onMouseDown}
        onSelect={onSelect}
        onPaste={onPaste}
        onScroll={(e) => {
          if (backdropRef.current) {
            backdropRef.current.scrollTop = e.currentTarget.scrollTop;
            backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
      />
    </div>
  );
}

// The textarea and backdrop MUST share identical box metrics or the colored
// text will drift from the caret.
const shared = (theme: GrafanaTheme2) => ({
  margin: 0,
  padding: theme.spacing(1.5, 1.5),
  border: 'none',
  fontFamily: theme.typography.fontFamilyMonospace,
  fontSize: theme.typography.body.fontSize,
  lineHeight: 1.8,
  whiteSpace: 'pre-wrap' as const,
  wordWrap: 'break-word' as const,
  overflowWrap: 'break-word' as const,
});

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    position: 'relative',
    width: '100%',
    cursor: 'text',
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    '&:focus-within': { borderColor: theme.colors.primary.border },
  }),
  backdrop: css({
    ...shared(theme),
    position: 'absolute',
    inset: 0,
    color: theme.colors.text.primary,
    pointerEvents: 'none',
    overflow: 'hidden',
  }),
  metric: css({ color: theme.colors.primary.text }),
  placeholder: css({ color: theme.colors.text.disabled }),
  // Faded, "un-finished" look for proposed text not yet committed.
  proposed: css({ color: theme.colors.text.disabled, opacity: 0.7 }),
  // A pending change waiting on accept — blue, tinted, still clearly not final.
  proposedBlue: css({
    color: theme.colors.primary.text,
    background: 'rgba(110, 159, 255, 0.16)',
    borderRadius: 2,
  }),
  // Persistent selection highlight for the section a popover refers to.
  highlight: css({ background: 'rgba(110, 159, 255, 0.28)', borderRadius: 2 }),
  // Unresolvable token, e.g. a misspelled metric name.
  error: css({
    textDecorationLine: 'underline',
    textDecorationStyle: 'wavy',
    textDecorationColor: theme.colors.error.text,
    textDecorationSkipInk: 'none',
    textUnderlineOffset: 3,
  }),
  textarea: css({
    ...shared(theme),
    position: 'relative',
    width: '100%',
    minHeight: 68,
    display: 'block',
    resize: 'none',
    background: 'transparent',
    color: 'transparent',
    // Bright, always-visible blinking caret like the real code editor.
    caretColor: theme.colors.text.maxContrast,
    outline: 'none',
    cursor: 'text',
  }),
});
