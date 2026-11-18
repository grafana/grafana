import { css, cx } from '@emotion/css';
import { type ReactNode, useLayoutEffect, useRef } from 'react';

import { type GrafanaTheme2, colorManipulator } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';

export function getScrollbarGeometry(size: number, contentSize: number) {
  const max = Math.max(0, contentSize - size);
  const thumbSize = Math.min(size, Math.max(24, (size * size) / Math.max(1, contentSize)));
  return { max, thumbSize, travel: size - thumbSize };
}

export function EditorScrollbar({
  scroller,
  orientation,
  top,
  left,
  size,
  contentSize,
  position,
  children,
}: {
  scroller: HTMLElement;
  orientation: 'vertical' | 'horizontal';
  top: number;
  left: number;
  size: number;
  contentSize: number;
  position: number;
  children?: ReactNode;
}) {
  const styles = useStyles2(getStyles);
  const track = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ pointer: number; position: number } | null>(null);
  const vertical = orientation === 'vertical';
  const { max, thumbSize, travel } = getScrollbarGeometry(size, contentSize);
  const scrollPosition = Math.max(0, Math.min(max, position));
  const setPosition = (position: number) => {
    scroller.scrollTo({ [vertical ? 'top' : 'left']: Math.max(0, Math.min(max, position)) });
  };

  useLayoutEffect(() => {
    const element = track.current!;
    const onWheel = (event: WheelEvent) => {
      const { scrollTop, scrollLeft } = scroller;
      const scale = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? scroller.clientHeight : 1;
      scroller.scrollBy({ top: event.deltaY * scale, left: event.deltaX * scale });
      // Let the wheel chain to the page once the editor is at its edge, like a native scrollbar.
      if (scroller.scrollTop !== scrollTop || scroller.scrollLeft !== scrollLeft) {
        event.preventDefault();
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [scroller]);

  return (
    <div
      ref={track}
      role="presentation"
      className={cx(styles.track, vertical ? styles.vertical : styles.horizontal)}
      style={{ top, left, [vertical ? 'height' : 'width']: size }}
      onPointerDown={(event) => {
        if (event.button !== 0 || event.target !== event.currentTarget || max === 0) {
          return;
        }
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const offset = vertical ? event.clientY - rect.top : event.clientX - rect.left;
        setPosition(((offset - thumbSize / 2) / Math.max(1, travel)) * max);
      }}
    >
      {children}
      {max > 0 && size > 0 && (
        <div
          className={styles.thumb}
          role="scrollbar"
          tabIndex={0}
          aria-label={
            vertical
              ? t('grafana-ui.code-mirror.scroll-vertically', 'Scroll vertically')
              : t('grafana-ui.code-mirror.scroll-horizontally', 'Scroll horizontally')
          }
          aria-orientation={orientation}
          aria-controls={scroller.id}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={scrollPosition}
          aria-valuetext={`${Math.round((scrollPosition / max) * 100)}%`}
          style={
            vertical
              ? { top: (scrollPosition / max) * travel, height: thumbSize }
              : { left: (scrollPosition / max) * travel, width: thumbSize }
          }
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragStart.current = {
              pointer: vertical ? event.clientY : event.clientX,
              position: scroller[vertical ? 'scrollTop' : 'scrollLeft'],
            };
          }}
          onPointerMove={(event) => {
            if (dragStart.current) {
              const delta = (vertical ? event.clientY : event.clientX) - dragStart.current.pointer;
              setPosition(dragStart.current.position + (delta / Math.max(1, travel)) * max);
            }
          }}
          onLostPointerCapture={() => {
            dragStart.current = null;
          }}
          onPointerUp={() => {
            dragStart.current = null;
          }}
          onPointerCancel={() => {
            dragStart.current = null;
          }}
          onKeyDown={(event) => {
            const current = scroller[vertical ? 'scrollTop' : 'scrollLeft'];
            const positions: Record<string, number> = {
              [vertical ? 'ArrowUp' : 'ArrowLeft']: current - 40,
              [vertical ? 'ArrowDown' : 'ArrowRight']: current + 40,
              PageUp: current - size,
              PageDown: current + size,
              Home: 0,
              End: max,
            };
            if (event.key in positions) {
              event.preventDefault();
              event.stopPropagation();
              setPosition(positions[event.key]);
            }
          }}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  track: css({
    position: 'absolute',
    background: theme.components.input.background,
    touchAction: 'none',
    userSelect: 'none',
  }),
  vertical: css({
    width: 12,
    '& > [role="scrollbar"]': { left: 1, width: 10 },
  }),
  horizontal: css({
    height: 12,
    '& > [role="scrollbar"]': { top: 1, height: 10 },
  }),
  thumb: css({
    position: 'absolute',
    borderRadius: theme.shape.radius.default,
    background: theme.colors.scrollbar,
    outline: 'none',
    '&:hover, &:active': { background: colorManipulator.alpha(theme.colors.scrollbar, 0.5) },
    '&:focus-visible': {
      outline: `1px solid ${theme.colors.text.secondary}`,
      outlineOffset: -1,
    },
    '@media (forced-colors: active)': {
      '&, &:hover, &:active': { background: 'CanvasText' },
    },
  }),
});
