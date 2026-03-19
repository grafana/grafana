/**
 * CollabCursorOverlay — renders remote user cursors on the dashboard canvas.
 *
 * Absolutely positioned overlay (pointer-events: none) that renders remote
 * cursors. Mouse tracking is done via a document-level mousemove listener
 * relative to the overlay container, sending at 10Hz throttle with
 * viewport-relative percentages. Labels fade after 3s, stale cursors
 * (no update in 5s) are removed.
 */

import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { throttle, toViewportPercent, CURSOR_THROTTLE_MS, LABEL_FADE_MS, STALE_CURSOR_MS } from './cursor-utils';
import { debugLog } from './debugLog';
import type { CursorUpdate } from './protocol/messages';
import { useCollab } from './useCollab';

interface CursorState {
  cursor: CursorUpdate;
  lastSeen: number;
  labelVisible: boolean;
}

export function CollabCursorOverlay() {
  const { connected, cursors, sendCursor } = useCollab();
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorStates, setCursorStates] = useState<Map<string, CursorState>>(new Map());
  const styles = useStyles2(getStyles);
  const localUserId = config.bootData?.user?.uid ?? '';

  // Update cursor states when new cursor data arrives from context
  useEffect(() => {
    setCursorStates((prev) => {
      const next = new Map(prev);
      const now = Date.now();

      cursors.forEach((cursor, userId) => {
        debugLog('Cursor update received', { userId, x: cursor.x, y: cursor.y });
        next.set(userId, {
          cursor,
          lastSeen: now,
          labelVisible: true,
        });
      });

      return next;
    });
  }, [cursors]);

  // Fade labels after LABEL_FADE_MS and remove stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorStates((prev) => {
        const now = Date.now();
        const next = new Map<string, CursorState>();
        let changed = false;

        prev.forEach((state, userId) => {
          const age = now - state.lastSeen;

          if (age > STALE_CURSOR_MS) {
            changed = true;
            return;
          }

          if (state.labelVisible && age > LABEL_FADE_MS) {
            next.set(userId, { ...state, labelVisible: false });
            changed = true;
          } else {
            next.set(userId, state);
          }
        });

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Throttled cursor send via document-level mousemove
  const sendCursorRef = useRef(sendCursor);
  sendCursorRef.current = sendCursor;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- throttle returns a stable wrapper; inner fn uses refs
  const handleMouseMove = useCallback(
    throttle((e: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      const { x, y } = toViewportPercent(e.clientX, e.clientY, containerRef.current);
      sendCursorRef.current({
        userId: localUserId,
        displayName: config.bootData?.user?.name ?? '',
        avatarUrl: config.bootData?.user?.gravatarUrl ?? '',
        color: '',
        x,
        y,
      });
    }, CURSOR_THROTTLE_MS),
    [localUserId]
  );

  useEffect(() => {
    if (!connected) {
      return;
    }
    debugLog('CollabCursorOverlay mounted — tracking active');
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      debugLog('CollabCursorOverlay unmounting — tracking stopped');
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [connected, handleMouseMove]);

  if (!connected) {
    return null;
  }

  return (
    <div ref={containerRef} className={styles.overlay}>
      {Array.from(cursorStates.entries()).map(([userId, state]) => (
        <RemoteCursor key={userId} cursor={state.cursor} labelVisible={state.labelVisible} />
      ))}
    </div>
  );
}

interface RemoteCursorProps {
  cursor: CursorUpdate;
  labelVisible: boolean;
}

function RemoteCursor({ cursor, labelVisible }: RemoteCursorProps) {
  const styles = useStyles2(getStyles);
  const color = cursor.color || '#e74c3c';

  return (
    <div
      className={styles.cursor}
      style={{
        left: `${cursor.x}%`,
        top: `${cursor.y}%`,
      }}
    >
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.arrow}
      >
        <path d="M0.5 0.5L15 10L8.5 11L5 19.5L0.5 0.5Z" fill={color} stroke="white" strokeWidth="1" />
      </svg>
      <span
        className={styles.label}
        style={{
          backgroundColor: color,
          opacity: labelVisible ? 1 : 0,
        }}
      >
        {cursor.displayName}
      </span>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    overlay: css({
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: theme.zIndex.tooltip - 1,
      overflow: 'hidden',
    }),
    cursor: css({
      position: 'absolute',
      // eslint-disable-next-line @grafana/no-unreduced-motion
      transition: 'left 100ms linear, top 100ms linear',
      willChange: 'left, top',
      pointerEvents: 'none',
    }),
    arrow: css({
      display: 'block',
      filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
    }),
    label: css({
      position: 'absolute',
      left: 16,
      top: 12,
      padding: '2px 6px',
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.maxContrast,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
      whiteSpace: 'nowrap',
      // eslint-disable-next-line @grafana/no-unreduced-motion
      transition: 'opacity 300ms ease-out',
      pointerEvents: 'none',
    }),
  };
}
