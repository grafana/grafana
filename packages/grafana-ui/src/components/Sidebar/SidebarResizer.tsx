import { css } from '@emotion/css';
import { useCallback, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { useSidebarContext } from './useSidebar';

export function SidebarResizer() {
  const styles = useStyles2(getStyles);
  const sidebarContext = useSidebarContext();
  const resizerRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<number | null>(null);

  if (!sidebarContext) {
    throw new Error('Sidebar.Resizer must be used within a Sidebar component');
  }

  const { onResize, position } = sidebarContext;

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

      // mouse is moving with no buttons pressed
      if (!e.buttons) {
        dragStart.current = null;
        return;
      }

      const diff = e.clientX - dragStart.current;
      dragStart.current = e.clientX;

      onResize(position === 'right' ? -diff : diff);
    },
    [dragStart, onResize, position]
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
      className={styles[sidebarContext.position]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    right: css({
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
    left: css({
      position: 'absolute',
      width: theme.spacing.gridSize,
      right: -theme.spacing.gridSize,
      top: theme.shape.radius.default,
      bottom: theme.shape.radius.default,
      cursor: 'col-resize',
      zIndex: 1,
      '&:hover': {
        borderLeft: `1px solid ${theme.colors.primary.border}`,
      },
    }),
  };
};
