import { css } from '@emotion/css';
import { useCallback, useContext, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { SidebarContext } from './useSidebar';

export function SidebarResizer() {
  const styles = useStyles2(getStyles);
  const context = useContext(SidebarContext);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<number | null>(null);

  if (!context) {
    throw new Error('Sidebar.Resizer must be used within a Sidebar component');
  }

  const { onResize } = context;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (resizerRef.current === null) {
        return;
      }

      resizerRef.current.setPointerCapture(e.pointerId);
      dragStart.current = e.clientX;
    },
    [resizerRef]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragStart.current === null) {
        return;
      }

      const diff = e.clientX - dragStart.current;
      dragStart.current = e.clientX;

      onResize(-diff);
    },
    [dragStart, onResize]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragStart.current = null;
    },
    [dragStart]
  );

  return (
    <div
      ref={resizerRef}
      className={styles.resizer}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    resizer: css({
      position: 'absolute',
      width: theme.spacing.gridSize,
      left: -theme.spacing.gridSize,
      top: theme.shape.radius.default,
      bottom: theme.shape.radius.default,
      cursor: 'col-resize',
      zIndex: 1,
      '&:hover': {
        borderRight: `1px solid ${theme.colors.primary.border}`,
      },
    }),
  };
};
