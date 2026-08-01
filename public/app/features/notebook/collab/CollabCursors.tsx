import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type RemotePeer } from './types';

const CURSOR_FRESHNESS_MS = 6000;

/**
 * Live cursor overlay: renders collaborators' pointers (caret + name pill in
 * their color) in notebook-document coordinates. Must be mounted inside a
 * position:relative container that matches the coordinate space cursors were
 * captured in.
 */
export function CollabCursors({ peers }: { peers: RemotePeer[] }) {
  const styles = useStyles2(getStyles);
  const now = Date.now();
  const visible = peers.filter((peer) => peer.cursor && now - peer.cursor.ts < CURSOR_FRESHNESS_MS);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className={styles.layer} aria-hidden>
      {visible.map((peer) => (
        <div
          key={peer.sid}
          className={styles.cursor}
          style={{ transform: `translate(${peer.cursor!.x}px, ${peer.cursor!.y}px)` }}
        >
          <svg width="14" height="18" viewBox="0 0 14 18" className={styles.caret}>
            <path d="M1 1 L13 9 L7 10.5 L4.5 17 Z" fill={peer.color} stroke="white" strokeWidth="1" />
          </svg>
          <span className={styles.pill} style={{ backgroundColor: peer.color }}>
            {peer.user.name || peer.user.login}
          </span>
        </div>
      ))}
    </div>
  );
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
      transition: 'transform 60ms linear',
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
