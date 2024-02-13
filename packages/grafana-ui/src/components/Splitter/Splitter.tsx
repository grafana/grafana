import { css, cx } from '@emotion/css';
import { clamp, throttle } from 'lodash';
import React, { useCallback, useId, useLayoutEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface Props {
  handleSize?: number;
  initialSize?: number | 'auto';
  direction?: 'row' | 'column';
  primary?: 'first' | 'second';
  collapsedDefault?: boolean;
  primaryPaneStyles?: React.CSSProperties;
  secondaryPaneStyles?: React.CSSProperties;
  onDragFinished?: (size: number) => void;
  children: [React.ReactNode, React.ReactNode];
}

const PIXELS_PER_MS = 0.3 as const;
const VERTICAL_KEYS = new Set(['ArrowUp', 'ArrowDown']);
const HORIZONTAL_KEYS = new Set(['ArrowLeft', 'ArrowRight']);

const propsForDirection = {
  row: {
    dim: 'width',
    axis: 'clientX',
    min: 'minWidth',
    max: 'maxWidth',
  },
  column: {
    dim: 'height',
    axis: 'clientY',
    min: 'minHeight',
    max: 'maxHeight',
  },
} as const;

export function Splitter({
  direction = 'row',
  handleSize = 32,
  initialSize = 'auto',
  primaryPaneStyles,
  secondaryPaneStyles,
  onDragFinished,
  children,
}: Props) {
  const kids = React.Children.toArray(children);

  const splitterRef = useRef<HTMLDivElement | null>(null);
  const firstPaneRef = useRef<HTMLDivElement | null>(null);
  const secondPaneRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerSize = useRef<number | null>(null);
  const primarySizeRef = useRef<'1fr' | number>('1fr');

  const firstPaneMeasurements = useRef<ReturnType<typeof measureElement>>(undefined);
  const savedPos = useRef<string | undefined>(undefined);

  const measurementProp = propsForDirection[direction].dim;
  const clientAxis = propsForDirection[direction].axis;
  const minDimProp = propsForDirection[direction].min;
  const maxDimProp = propsForDirection[direction].max;

  // Using a resize observer here, as with content or screen based width/height the ratio between panes might
  // change after a window resize, so ariaValueNow needs to be updated accordingly
  useResizeObserver(
    containerRef.current!,
    (entries) => {
      for (const entry of entries) {
        if (!entry.target.isSameNode(containerRef.current)) {
          return;
        }

        const curSize = firstPaneRef.current!.getBoundingClientRect()[measurementProp];
        const newDims = measureElement(firstPaneRef.current!);
        splitterRef.current!.ariaValueNow = `${clamp(
          ((curSize - newDims[minDimProp]) / (newDims[maxDimProp] - newDims[minDimProp])) * 100,
          0,
          100
        )}`;
      }
    },
    500,
    [maxDimProp, minDimProp, direction, measurementProp]
  );

  const dragStart = useRef<number | null>(null);
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // measure left-side width
      primarySizeRef.current = firstPaneRef.current!.getBoundingClientRect()[measurementProp];
      containerSize.current = containerRef.current!.getBoundingClientRect()[measurementProp];

      // set position at start of drag
      dragStart.current = e[clientAxis];
      splitterRef.current!.setPointerCapture(e.pointerId);
      firstPaneMeasurements.current = measureElement(firstPaneRef.current!);

      savedPos.current = undefined;
    },
    [measurementProp, clientAxis]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragStart.current !== null && primarySizeRef.current !== '1fr') {
        const diff = e[clientAxis] - dragStart.current;
        const dims = firstPaneMeasurements.current!;
        const newSize = clamp(primarySizeRef.current + diff, dims[minDimProp], dims[maxDimProp]);
        const newFlex = newSize / (containerSize.current! - handleSize);
        firstPaneRef.current!.style.flexGrow = `${newFlex}`;
        secondPaneRef.current!.style.flexGrow = `${1 - newFlex}`;
        const ariaValueNow = clamp(
          ((newSize - dims[minDimProp]) / (dims[maxDimProp] - dims[minDimProp])) * 100,
          0,
          100
        );

        splitterRef.current!.ariaValueNow = `${ariaValueNow}`;
      }
    },
    [handleSize, clientAxis, minDimProp, maxDimProp]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      splitterRef.current!.releasePointerCapture(e.pointerId);
      dragStart.current = null;
      onDragFinished?.(parseFloat(firstPaneRef.current!.style.flexGrow));
    },
    [onDragFinished]
  );

  const pressedKeys = useRef(new Set<string>());
  const keysLastHandledAt = useRef<number | null>(null);
  const handlePressedKeys = useCallback(
    (time: number) => {
      const nothingPressed = pressedKeys.current.size === 0;
      if (nothingPressed) {
        keysLastHandledAt.current = null;
        return;
      } else if (primarySizeRef.current === '1fr') {
        return;
      }

      const dt = time - (keysLastHandledAt.current ?? time);
      const dx = dt * PIXELS_PER_MS;
      let sizeChange = 0;

      if (direction === 'row') {
        if (pressedKeys.current.has('ArrowLeft')) {
          sizeChange -= dx;
        }
        if (pressedKeys.current.has('ArrowRight')) {
          sizeChange += dx;
        }
      } else {
        if (pressedKeys.current.has('ArrowUp')) {
          sizeChange -= dx;
        }
        if (pressedKeys.current.has('ArrowDown')) {
          sizeChange += dx;
        }
      }

      const firstPaneDims = firstPaneMeasurements.current!;
      const curSize = firstPaneRef.current!.getBoundingClientRect()[measurementProp];
      const newSize = clamp(curSize + sizeChange, firstPaneDims[minDimProp], firstPaneDims[maxDimProp]);

      const newFlex = newSize / (containerSize.current! - handleSize);

      firstPaneRef.current!.style.flexGrow = `${newFlex}`;
      secondPaneRef.current!.style.flexGrow = `${1 - newFlex}`;
      const ariaValueNow =
        ((newSize - firstPaneDims[minDimProp]) / (firstPaneDims[maxDimProp] - firstPaneDims[minDimProp])) * 100;
      splitterRef.current!.ariaValueNow = `${clamp(ariaValueNow, 0, 100)}`;

      keysLastHandledAt.current = time;
      window.requestAnimationFrame(handlePressedKeys);
    },
    [direction, handleSize, minDimProp, maxDimProp, measurementProp]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        if (savedPos.current === undefined) {
          savedPos.current = firstPaneRef.current!.style.flexGrow;
          firstPaneRef.current!.style.flexGrow = '0';
          secondPaneRef.current!.style.flexGrow = '1';
        } else {
          firstPaneRef.current!.style.flexGrow = savedPos.current;
          secondPaneRef.current!.style.flexGrow = `${1 - parseFloat(savedPos.current)}`;
          savedPos.current = undefined;
        }
        return;
      } else if (e.key === 'Home') {
        firstPaneMeasurements.current = measureElement(firstPaneRef.current!);
        containerSize.current = containerRef.current!.getBoundingClientRect()[measurementProp];
        const newFlex = firstPaneMeasurements.current[minDimProp] / (containerSize.current! - handleSize);
        firstPaneRef.current!.style.flexGrow = `${newFlex}`;
        secondPaneRef.current!.style.flexGrow = `${1 - newFlex}`;
        splitterRef.current!.ariaValueNow = '0';
        return;
      } else if (e.key === 'End') {
        firstPaneMeasurements.current = measureElement(firstPaneRef.current!);
        containerSize.current = containerRef.current!.getBoundingClientRect()[measurementProp];
        const newFlex = firstPaneMeasurements.current[maxDimProp] / (containerSize.current! - handleSize);
        firstPaneRef.current!.style.flexGrow = `${newFlex}`;
        secondPaneRef.current!.style.flexGrow = `${1 - newFlex}`;
        splitterRef.current!.ariaValueNow = '100';
        return;
      }

      if (
        !(
          (direction === 'column' && VERTICAL_KEYS.has(e.key)) ||
          (direction === 'row' && HORIZONTAL_KEYS.has(e.key))
        ) ||
        pressedKeys.current.has(e.key)
      ) {
        return;
      }

      savedPos.current = undefined;
      e.preventDefault();
      e.stopPropagation();
      primarySizeRef.current = firstPaneRef.current!.getBoundingClientRect()[measurementProp];
      containerSize.current = containerRef.current!.getBoundingClientRect()[measurementProp];
      firstPaneMeasurements.current = measureElement(firstPaneRef.current!);
      const newKey = !pressedKeys.current.has(e.key);

      if (newKey) {
        const initiateAnimationLoop = pressedKeys.current.size === 0;
        pressedKeys.current.add(e.key);

        if (initiateAnimationLoop) {
          window.requestAnimationFrame(handlePressedKeys);
        }
      }
    },
    [direction, handlePressedKeys, handleSize, maxDimProp, measurementProp, minDimProp]
  );

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        (direction === 'row' && !HORIZONTAL_KEYS.has(e.key)) ||
        (direction === 'column' && !VERTICAL_KEYS.has(e.key))
      ) {
        return;
      }

      pressedKeys.current.delete(e.key);
      onDragFinished?.(parseFloat(firstPaneRef.current!.style.flexGrow));
    },
    [direction, onDragFinished]
  );

  const onDoubleClick = useCallback(() => {
    firstPaneRef.current!.style.flexGrow = '0.5';
    secondPaneRef.current!.style.flexGrow = '0.5';
    const dim = measureElement(firstPaneRef.current!);
    firstPaneMeasurements.current = dim;
    primarySizeRef.current = firstPaneRef.current!.getBoundingClientRect()[measurementProp];
    splitterRef.current!.ariaValueNow = `${
      ((primarySizeRef.current - dim[minDimProp]) / (dim[maxDimProp] - dim[minDimProp])) * 100
    }`;
  }, [maxDimProp, measurementProp, minDimProp]);

  const onBlur = useCallback(() => {
    // If focus is lost while keys are held, stop changing panel sizes
    if (pressedKeys.current.size > 0) {
      pressedKeys.current.clear();
      dragStart.current = null;
      onDragFinished?.(parseFloat(firstPaneRef.current!.style.flexGrow));
    }
  }, [onDragFinished]);

  const styles = useStyles2(getStyles);
  const id = useId();

  const secondAvailable = kids.length === 2;
  const visibilitySecond = secondAvailable ? 'visible' : 'hidden';

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{
        flexDirection: direction,
      }}
    >
      <div
        ref={firstPaneRef}
        className={styles.panel}
        style={{
          flexGrow: initialSize === 'auto' ? 0.5 : clamp(initialSize, 0, 1),
          [minDimProp]: 'min-content',
          ...primaryPaneStyles,
        }}
        id={`start-panel-${id}`}
      >
        {kids[0]}
      </div>

      {kids[1] && (
        <>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            ref={splitterRef}
            style={{ [measurementProp]: `${handleSize}px` }}
            className={cx(styles.handle, { [styles.handleHorizontal]: direction === 'column' })}
            onPointerUp={onPointerUp}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onDoubleClick={onDoubleClick}
            onBlur={onBlur}
            role="separator"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={50}
            aria-controls={`start-panel-${id}`}
            aria-label="Pane resize widget"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          ></div>

          <div
            ref={secondPaneRef}
            className={styles.panel}
            style={{
              flexGrow: initialSize === 'auto' ? 0.5 : clamp(1 - initialSize, 0, 1),
              [minDimProp]: 'min-content',
              visibility: `${visibilitySecond}`,
              ...secondaryPaneStyles,
            }}
            id={`end-panel-${id}`}
          >
            {kids[1]}
          </div>
        </>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    handle: css({
      cursor: 'col-resize',
      position: 'relative',
      flexShrink: 0,
      userSelect: 'none',

      '&::before': {
        content: '""',
        position: 'absolute',
        backgroundColor: theme.colors.primary.main,
        left: '50%',
        transform: 'translate(-50%)',
        top: 0,
        height: '100%',
        width: '1px',
        opacity: 0,
        transition: 'opacity ease-in-out 0.2s',
      },

      '&::after': {
        content: '""',
        width: '4px',
        borderRadius: '4px',
        backgroundColor: theme.colors.border.weak,
        transition: 'background-color ease-in-out 0.2s',
        height: '50%',
        top: 'calc(50% - (50%) / 2)',
        transform: 'translateX(-50%)',
        position: 'absolute',
        left: '50%',
      },

      '&:hover, &:focus-visible': {
        outline: 'none',
        '&::before': {
          opacity: 1,
        },

        '&::after': {
          backgroundColor: theme.colors.primary.main,
        },
      },
    }),
    handleHorizontal: css({
      cursor: 'row-resize',

      '&::before': {
        left: 'inherit',
        transform: 'translateY(-50%)',
        top: '50%',
        height: '1px',
        width: '100%',
      },

      '&::after': {
        width: '50%',
        height: '4px',
        top: '50%',
        transform: 'translateY(-50%)',
        left: 'calc(50% - (50%) / 2)',
      },
    }),
    container: css({
      display: 'flex',
      width: '100%',
      flexGrow: 1,
      overflow: 'hidden',
    }),
    panel: css({ display: 'flex', position: 'relative', flexBasis: 0 }),
  };
}

type MeasureR<T> = T extends HTMLElement
  ? { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number }
  : T extends null
    ? undefined
    : never;
type HTMLElementOrNull = HTMLElement | null;

function measureElement<T extends HTMLElementOrNull>(ref: T): MeasureR<T> {
  if (ref === null) {
    return undefined as MeasureR<T>;
  }

  const savedBodyOverflow = document.body.style.overflow;
  const savedWidth = ref.style.width;
  const savedHeight = ref.style.height;
  const savedFlex = ref.style.flexGrow;
  document.body.style.overflow = 'hidden';
  ref.style.flexGrow = '0';
  const { width: minWidth, height: minHeight } = ref.getBoundingClientRect();

  ref.style.flexGrow = '100';
  const { width: maxWidth, height: maxHeight } = ref.getBoundingClientRect();

  document.body.style.overflow = savedBodyOverflow;
  ref.style.width = savedWidth;
  ref.style.height = savedHeight;
  ref.style.flexGrow = savedFlex;

  return { minWidth, maxWidth, minHeight, maxHeight } as MeasureR<T>;
}

function useResizeObserver(
  target: Element,
  cb: (entries: ResizeObserverEntry[]) => void,
  throttleWait = 0,
  deps?: React.DependencyList
) {
  const throttledCallback = throttle(cb, throttleWait);

  useLayoutEffect(() => {
    if (!target) {
      return;
    }

    const resizeObserver = new ResizeObserver(throttledCallback);

    resizeObserver.observe(target, { box: 'device-pixel-content-box' });
    return () => resizeObserver.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
