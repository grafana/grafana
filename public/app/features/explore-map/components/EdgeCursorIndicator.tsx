/**
 * Component to display cursor indicators at the edge of the viewport
 * for cursors that are currently off-screen
 */

import { css, keyframes } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CursorViewportInfo } from '../hooks/useCursorViewportTracking';

interface EdgeCursorIndicatorProps {
  cursorInfo: CursorViewportInfo;
}

export function EdgeCursorIndicator({ cursorInfo }: EdgeCursorIndicatorProps) {
  const styles = useStyles2(getStyles);

  if (cursorInfo.isVisible || !cursorInfo.edgePosition) {
    return null;
  }

  const { cursor, edgePosition } = cursorInfo;
  const { x, y, side } = edgePosition;

  // Calculate rotation based on side
  let rotation = 0;
  switch (side) {
    case 'top':
      rotation = -90;
      break;
    case 'bottom':
      rotation = 90;
      break;
    case 'left':
      rotation = 180;
      break;
    case 'right':
      rotation = 0;
      break;
  }

  return (
    <div
      className={styles.container}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div className={styles.indicator} style={{ backgroundColor: cursor.color }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <path d="M6 4L10 8L6 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className={styles.label} style={{ backgroundColor: cursor.color }}>
        {cursor.userName}
      </div>
    </div>
  );
}

const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
`;

const fadeInAnimation = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
`;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: 10001, // Above regular cursors
      transform: 'translate(-50%, -50%)',
      transition: 'left 0.2s ease-out, top 0.2s ease-out, opacity 0.2s ease-out',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      animation: `${fadeInAnimation} 0.2s ease-out`,
    }),
    indicator: css({
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: theme.shadows.z3,
      border: `2px solid white`,
      animation: `${pulseAnimation} 2s ease-in-out infinite`,
    }),
    label: css({
      padding: '2px 6px',
      borderRadius: theme.shape.radius.default,
      color: 'white',
      fontSize: '11px',
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      boxShadow: theme.shadows.z2,
    }),
  };
};
