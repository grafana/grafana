import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type RemotePeer } from './types';

const CURSOR_FRESHNESS_MS = 6000;
const POLL_INTERVAL_MS = 80;

interface CursorView {
  sid: string;
  x: number;
  y: number;
  color: string;
  label: string;
}

/**
 * Live cursor overlay: renders collaborators' pointers (caret + name pill in
 * their color) in notebook-document coordinates. Positions are polled from the
 * collab peers ref rather than passed as React state — cursor moves arrive at
 * pointer frequency and must only re-render this tiny layer, not the editor.
 * Must be mounted inside a position:relative container matching the coordinate
 * space cursors were captured in.
 */
export function CollabCursors({ getPeers }: { getPeers: () => RemotePeer[] }) {
  const styles = useStyles2(getStyles);
  const [cursors, setCursors] = useState<CursorView[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const next = getPeers()
        .filter((peer) => peer.cursor && now - peer.cursor.ts < CURSOR_FRESHNESS_MS)
        .map((peer) => ({
          sid: peer.sid,
          x: peer.cursor!.x,
          y: peer.cursor!.y,
          color: peer.color,
          label: peer.user.name || peer.user.login,
        }));

      setCursors((current) => (cursorsEqual(current, next) ? current : next));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [getPeers]);

  if (cursors.length === 0) {
    return null;
  }

  return (
    <div className={styles.layer} aria-hidden>
      {cursors.map((cursor) => (
        <div
          key={cursor.sid}
          className={styles.cursor}
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <svg width="14" height="18" viewBox="0 0 14 18" className={styles.caret}>
            <path d="M1 1 L13 9 L7 10.5 L4.5 17 Z" fill={cursor.color} stroke="white" strokeWidth="1" />
          </svg>
          <span className={styles.pill} style={{ backgroundColor: cursor.color }}>
            {cursor.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function cursorsEqual(a: CursorView[], b: CursorView[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((cursor, i) => {
    const other = b[i];
    return cursor.sid === other.sid && cursor.x === other.x && cursor.y === other.y && cursor.color === other.color;
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  layer: css({
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: theme.zIndex.tooltip,
  }),
  cursor: css({
    position: 'absolute',
    top: 0,
    left: 0,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 2,

    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'transform 80ms linear',
    },
  }),
  caret: css({
    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
  }),
  pill: css({
    marginTop: 10,
    color: '#fff',
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.6,
    padding: theme.spacing(0, 0.75),
    borderRadius: theme.shape.radius.pill,
    whiteSpace: 'nowrap',
    boxShadow: theme.shadows.z1,
  }),
});
