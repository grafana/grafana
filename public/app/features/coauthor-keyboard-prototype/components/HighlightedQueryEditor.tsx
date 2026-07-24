import { css } from '@emotion/css';
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
  onSelect?: () => void;
  onPaste?: () => void;
  /** When set, the backdrop shows this proposed query (proposed spans faded)
   * instead of the committed value. */
  preview?: PreviewSegment[] | null;
  /** When set (and no preview), paints a persistent selection highlight over
   * this char range, so it's clear which section a popover refers to. */
  highlightRange?: { start: number; end: number } | null;
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
  onSelect,
  onPaste,
  preview,
  highlightRange,
}: Props) {
  const styles = useStyles2(getStyles);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Render a committed run with metric names highlighted.
  const renderReal = (text: string, keyPrefix: string) =>
    highlightSegments(text).map((seg, i) => (
      <span key={`${keyPrefix}-${i}`} className={seg.metric ? styles.metric : undefined}>
        {seg.text}
      </span>
    ));

  let backdrop: React.ReactNode;
  if (preview) {
    backdrop = preview.map((seg, i) =>
      seg.proposed ? (
        <span key={i} className={styles.proposed}>
          {seg.text}
        </span>
      ) : (
        <span key={i}>{renderReal(seg.text, `p${i}`)}</span>
      )
    );
  } else if (highlightRange && value) {
    const { start, end } = highlightRange;
    backdrop = (
      <>
        {renderReal(value.slice(0, start), 'b')}
        <span className={styles.highlight}>{renderReal(value.slice(start, end), 'h')}</span>
        {renderReal(value.slice(end), 'a')}
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
  // Persistent selection highlight for the section a popover refers to.
  highlight: css({ background: 'rgba(110, 159, 255, 0.28)', borderRadius: 2 }),
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
