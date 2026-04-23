import { css } from '@emotion/css';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { Portal, useStyles2, useTheme2 } from '@grafana/ui';

import { useChromeHeaderHeight } from '../TopBar/useChromeHeaderHeight';

import { FeatureControlFlags } from './FeatureControlFlags';
import { type FeatureControlCorner, useFeatureControlContext } from './FeatureControlProvider';

type DragPosition = {
  x: number;
  y: number;
};

const getRects = (boundsRef: RefObject<HTMLDivElement>, wrapperRef: RefObject<HTMLDivElement>) => ({
  bounds: boundsRef.current?.getBoundingClientRect(),
  wrapper: wrapperRef.current?.getBoundingClientRect(),
});

const getClosestCorner = (
  x: number,
  y: number,
  width: number,
  height: number,
  containerWidth: number,
  containerHeight: number
): FeatureControlCorner => {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const vertical = centerY <= containerHeight / 2 ? 'top' : 'bottom';
  const horizontal = centerX <= containerWidth / 2 ? 'left' : 'right';

  if (vertical === 'top') {
    return horizontal === 'left' ? 'top-left' : 'top-right';
  }
  return horizontal === 'left' ? 'bottom-left' : 'bottom-right';
};

const CORNER_POSITIONS: Record<FeatureControlCorner, CSSProperties> = {
  'top-left': { top: 0, right: 'auto', bottom: 'auto', left: 0 },
  'top-right': { top: 0, right: 0, bottom: 'auto', left: 'auto' },
  'bottom-left': { top: 'auto', right: 'auto', bottom: 0, left: 0 },
  'bottom-right': { top: 'auto', right: 0, bottom: 0, left: 'auto' },
};

export const FeatureControlFloating = () => {
  const { corner, isOpen, setCorner } = useFeatureControlContext();
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const headerHeight = useChromeHeaderHeight();
  const boundsRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<DragPosition>({ x: 0, y: 0 });
  const lastDragPositionRef = useRef<DragPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      const { bounds: boundsRect, wrapper: wrapperRect } = getRects(boundsRef, wrapperRef);
      if (!wrapperRect || !boundsRect) {
        return;
      }

      const maxX = Math.max(0, boundsRect.width - wrapperRect.width);
      const maxY = Math.max(0, boundsRect.height - wrapperRect.height);

      const nextPosition = {
        x: Math.min(Math.max(0, event.clientX - boundsRect.left - dragOffsetRef.current.x), maxX),
        y: Math.min(Math.max(0, event.clientY - boundsRect.top - dragOffsetRef.current.y), maxY),
      };

      lastDragPositionRef.current = nextPosition;
      setDragPosition(nextPosition);
    };

    const handlePointerUp = () => {
      const { bounds: boundsRect, wrapper: wrapperRect } = getRects(boundsRef, wrapperRef);
      if (wrapperRect && boundsRect && lastDragPositionRef.current) {
        const nextCorner = getClosestCorner(
          lastDragPositionRef.current.x,
          lastDragPositionRef.current.y,
          wrapperRect.width,
          wrapperRect.height,
          boundsRect.width,
          boundsRect.height
        );
        setCorner(nextCorner);
      }

      setIsDragging(false);
      setDragPosition(null);
      lastDragPositionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, setCorner]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();

    const { bounds: boundsRect, wrapper: wrapperRect } = getRects(boundsRef, wrapperRef);
    if (!wrapperRect || !boundsRect) {
      return;
    }

    dragOffsetRef.current = {
      x: event.clientX - wrapperRect.left,
      y: event.clientY - wrapperRect.top,
    };

    lastDragPositionRef.current = {
      x: wrapperRect.left - boundsRect.left,
      y: wrapperRect.top - boundsRect.top,
    };
    setDragPosition(lastDragPositionRef.current);
    setIsDragging(true);
  };

  if (!isOpen) {
    return null;
  }

  const portalStyle = dragPosition
    ? {
        ...CORNER_POSITIONS['top-left'],
        transform: `translate(${dragPosition.x}px, ${dragPosition.y}px)`,
        cursor: 'grabbing' as const,
      }
    : CORNER_POSITIONS[corner];

  return (
    <Portal zIndex={theme.zIndex.modal}>
      <div
        ref={boundsRef}
        className={styles.bounds}
        style={{ marginTop: `calc(${headerHeight}px + ${theme.spacing(3)})` }}
      >
        <div ref={wrapperRef} className={styles.portal} style={portalStyle}>
          <FeatureControlFlags className={styles.card} onPointerDown={onPointerDown} />
        </div>
      </div>
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  bounds: css({
    position: 'fixed',
    inset: 0,
    margin: theme.spacing(3),
    boxSizing: 'border-box',
    pointerEvents: 'none',
  }),
  portal: css({
    position: 'absolute',
    top: 0,
    left: 0,
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'auto',
    touchAction: 'none',
  }),
  card: css({
    width: theme.spacing(50),
    maxHeight: '100%',
    overflowY: 'auto',
    cursor: 'grab',

    '> *': {
      cursor: 'auto',
    },
  }),
});
