// Prototype-only. Not internationalized.
// Overlay menu shown when insertion placement is ambiguous. Portaled to
// document.body so it floats above the rail and isn't clipped by
// overflow:hidden on ancestors. Positioned at the anchor's right edge.

import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import type { InsertionChoice } from './promqlInsertion';

interface Props {
  reason: string;
  options: InsertionChoice[];
  anchor: DOMRect;
  onPick: (choice: InsertionChoice) => void;
  onDismiss: () => void;
}

const LABEL: Record<InsertionChoice, string> = {
  overwrite: 'Overwrite existing query',
  newQuery: 'Add new query',
  splitView: 'Open in split view',
};

const MENU_WIDTH = 260;
const MENU_GAP = 8;

export function InsertionActionMenu({ reason, options, anchor, onPick, onDismiss }: Props) {
  const styles = useStyles2(getStyles);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focused, setFocused] = useState(0);

  // Keep DOM focus in sync with the tracked index so the enter-hint indicator
  // and native keyboard focus don't diverge.
  useEffect(() => {
    itemRefs.current[focused]?.focus();
  }, [focused]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        onDismiss();
        return;
      }
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        setFocused((i) => (i + 1) % options.length);
        return;
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        setFocused((i) => (i - 1 + options.length) % options.length);
        return;
      }
      if (ev.key === 'Enter') {
        const choice = options[focused];
        if (choice) {
          ev.preventDefault();
          onPick(choice);
          onDismiss();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss, onPick, options, focused]);

  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (t && wrapRef.current?.contains(t)) {
        return;
      }
      onDismiss();
    };
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onDismiss]);

  // Prefer right-of-anchor; if that overflows, fall back to left-of-anchor.
  const preferredLeft = anchor.right + MENU_GAP;
  const overflowsRight = preferredLeft + MENU_WIDTH > window.innerWidth - 8;
  const style: React.CSSProperties = {
    top: Math.max(8, Math.min(anchor.top, window.innerHeight - 200)),
    left: overflowsRight ? Math.max(8, anchor.left - MENU_WIDTH - MENU_GAP) : preferredLeft,
    width: MENU_WIDTH,
  };

  return createPortal(
    <div className={styles.wrap} style={style} ref={wrapRef} role="dialog" aria-label="Choose insertion behavior">
      <div className={styles.reason}>{reason}</div>
      <ul className={styles.list}>
        {options.map((opt, idx) => (
          <li key={opt}>
            <button
              type="button"
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              className={styles.item}
              onMouseEnter={() => setFocused(idx)}
              onFocus={() => setFocused(idx)}
              onClick={() => {
                onPick(opt);
                onDismiss();
              }}
            >
              <span className={styles.itemLabel}>{LABEL[opt]}</span>
              {idx === focused && (
                <span className={styles.enterHint} aria-label="Enter">
                  &#x21B5;
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
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
    padding: theme.spacing(0.5),
  }),
  reason: css({
    padding: theme.spacing(0.75, 1),
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  item: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    '&:hover, &:focus-visible': {
      background: theme.colors.action.hover,
      outline: 'none',
    },
  }),
  itemLabel: css({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  enterHint: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.xs,
  }),
});
