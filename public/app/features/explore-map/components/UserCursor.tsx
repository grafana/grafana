import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { UserCursor as UserCursorType } from '../state/types';

interface UserCursorProps {
  cursor: UserCursorType;
}

export function UserCursor({ cursor }: UserCursorProps) {
  const styles = useStyles2(getStyles);

  return (
    <div
      className={styles.cursorContainer}
      style={{
        left: cursor.x,
        top: cursor.y,
      }}
    >
      <svg
        className={styles.cursorSvg}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 3L5 16L9 12L12 19L14 18L11 11L17 11L5 3Z"
          fill={cursor.color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className={styles.label} style={{ backgroundColor: cursor.color }}>
        {cursor.userName}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cursorContainer: css({
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: 10000,
      // Smooth transition matching the update frequency (100ms)
      // Using linear for more predictive movement
      transition: 'left 0.1s linear, top 0.1s linear',
      // Will-change hint for better performance
      willChange: 'left, top',
    }),
    cursorSvg: css({
      display: 'block',
      filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
    }),
    label: css({
      position: 'absolute',
      left: '20px',
      top: '20px',
      padding: '4px 8px',
      borderRadius: theme.shape.radius.default,
      color: 'white',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      boxShadow: theme.shadows.z2,
    }),
  };
};
