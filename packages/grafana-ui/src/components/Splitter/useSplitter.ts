import { css } from '@emotion/css';
import { clamp } from 'lodash';
import { useCallback, useId, useRef } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { ComponentSize } from '../../types';
import { DragHandlePosition, getDragStyles } from '../DragHandle/DragHandle';

export interface UseSplitterOptions {
  /**
   * The initial size of the primary pane between 0-1, defaults to 0.5
   * If `usePixels` is true, this is the initial size in pixels of the second pane.
   */
  initialSize?: number;
  direction: 'row' | 'column';
  dragPosition?: DragHandlePosition;
  usePixels?: boolean;
  /**
   * Called when ever the size of the primary pane changes
   * @param flexSize (float from 0-1)
   */
  onSizeChanged?: (flexSize: number, firstPanePixels: number, secondPanePixels: number) => void;
  onResizing?: (flexSize: number, firstPanePixels: number, secondPanePixels: number) => void;

  // Size of the region left of the handle indicator that is responsive to dragging. At the same time acts as a margin
  // pushing the left pane content left.
  handleSize?: ComponentSize;
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

export function useSplitter(options: UseSplitterOptions) {
  const {
    direction,
    initialSize = options.usePixels ? 300 : 0.5,
    dragPosition = 'middle',
    onResizing,
    onSizeChanged,
    usePixels,
  } = options;

  const handleSize = getPixelSize(options.handleSize);
  const splitterRef = useRef<HTMLDivElement | null>(null);
  const firstPaneRef = useRef<HTMLDivElement | null>(null);
  const secondPaneRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerSize = useRef<number | null>(null);
  const primarySizeRef = useRef<number | null>(null);
  const referencePaneSize = useRef<MeasureResult | undefined>(undefined);
  const savedPos = useRef<string | undefined>(undefined);

  const measurementProp = propsForDirection[direction].dim;
  const clientAxis = propsForDirection[direction].axis;
  const minDimProp = propsForDirection[direction].min;
  const maxDimProp = propsForDirection[direction].max;
  const dragStart = useRef<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!firstPaneRef.current || !secondPaneRef.current) {
        return;
      }

      // measure left-side width
      primarySizeRef.current = firstPaneRef.current!.getBoundingClientRect()[measurementProp];
      containerSize.current = containerRef.current!.getBoundingClientRect()[measurementProp];

      dragStart.current = e[clientAxis];
      splitterRef.current!.setPointerCapture(e.pointerId);

      if (usePixels) {
        referencePaneSize.current = measureElement(secondPaneRef.current, usePixels);
      } else {
        referencePaneSize.current = measureElement(firstPaneRef.current);
      }

      savedPos.current = undefined;
    },
    [measurementProp, clientAxis, usePixels]
  );

  const onUpdateSize = useCallback(
    (diff: number) => {
      if (!containerSize.current || !primarySizeRef.current || !secondPaneRef.current) {
        return;
      }

      const firstPanePixels = primarySizeRef.current;
      const secondPanePixels = containerSize.current - firstPanePixels - handleSize;
      const dims = referencePaneSize.current!;

      if (usePixels) {
        const newSize = clamp(secondPanePixels - diff, dims[minDimProp], dims[maxDimProp]);
        secondPaneRef.current!.style.flexBasis = `${newSize}px`;
        splitterRef.current!.ariaValueNow = `${newSize}`;
        onResizing?.(newSize, firstPanePixels + diff, newSize);
      } else {
        const newSize = clamp(primarySizeRef.current + diff, dims[minDimProp], dims[maxDimProp]);
        const newFlex = newSize / (containerSize.current! - handleSize);
        firstPaneRef.current!.style.flexGrow = `${newFlex}`;
        secondPaneRef.current!.style.flexGrow = `${1 - newFlex}`;
        splitterRef.current!.ariaValueNow = ariaValue(newSize, dims[minDimProp], dims[maxDimProp]);
        onResizing?.(newFlex, newSize, secondPanePixels - diff);
      }
    },
    [onResizing, handleSize, usePixels, minDimProp, maxDimProp]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragStart.current !== null) {
        onUpdateSize(e[clientAxis] - dragStart.current);
      }
    },
    [onUpdateSize, clientAxis]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      dragStart.current = null;

      splitterRef.current!.releasePointerCapture(e.pointerId);

      const firstPaneSize = firstPaneRef.current!.getBoundingClientRect()[measurementProp];
      const secondPanePixels = containerSize.current! - firstPaneSize - handleSize;

      onSizeChanged?.(parseFloat(firstPaneRef.current!.style.flexGrow), firstPaneSize, secondPanePixels);
    },
    [onSizeChanged, handleSize, measurementProp]
  );

  const pressedKeys = useRef(new Set<string>());
  const keysLastHandledAt = useRef<number | null>(null);
  const handlePressedKeys = useCallback(
    (time: number) => {
      const nothingPressed = pressedKeys.current.size === 0;
      if (nothingPressed) {
        keysLastHandledAt.current = null;
        return;
      } else if (primarySizeRef.current === null) {
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

      // measure primary and container
      primarySizeRef.current = firstPaneRef.current!.getBoundingClientRect()[measurementProp];
      containerSize.current = containerRef.current!.getBoundingClientRect()[measurementProp];

      onUpdateSize(sizeChange);

      keysLastHandledAt.current = time;

      window.requestAnimationFrame(handlePressedKeys);
    },
    [direction, measurementProp, onUpdateSize]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!firstPaneRef.current || !secondPaneRef.current || !splitterRef.current || !containerRef.current) {
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

      primarySizeRef.current = firstPaneRef.current.getBoundingClientRect()[measurementProp];
      containerSize.current = containerRef.current!.getBoundingClientRect()[measurementProp];

      if (usePixels) {
        referencePaneSize.current = measureElement(secondPaneRef.current!);
      } else {
        referencePaneSize.current = measureElement(firstPaneRef.current!);
      }

      const newKey = !pressedKeys.current.has(e.key);

      if (newKey) {
        const initiateAnimationLoop = pressedKeys.current.size === 0;
        pressedKeys.current.add(e.key);

        if (initiateAnimationLoop) {
          window.requestAnimationFrame(handlePressedKeys);
        }
      }
    },
    [direction, handlePressedKeys, , measurementProp, usePixels]
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

      if (primarySizeRef.current !== null) {
        const secondPanePixels = containerSize.current! - primarySizeRef.current - handleSize;
        onSizeChanged?.(parseFloat(firstPaneRef.current!.style.flexGrow), primarySizeRef.current, secondPanePixels);
      }
    },
    [direction, onSizeChanged, handleSize]
  );

  const onDoubleClick = useCallback(() => {
    if (!firstPaneRef.current || !secondPaneRef.current) {
      return;
    }

    if (usePixels) {
      secondPaneRef.current.style.flexBasis = `${initialSize}px`;
    } else {
      firstPaneRef.current.style.flexGrow = '0.5';
      secondPaneRef.current.style.flexGrow = '0.5';
      primarySizeRef.current = firstPaneRef.current!.getBoundingClientRect()[measurementProp];
      splitterRef.current!.ariaValueNow = `50`;
    }
  }, [measurementProp, usePixels, initialSize]);

  const onBlur = useCallback(() => {
    // If focus is lost while keys are held, stop changing panel sizes
    if (pressedKeys.current.size > 0) {
      pressedKeys.current.clear();
      dragStart.current = null;

      if (typeof primarySizeRef.current === 'number') {
        const secondPanePixels = containerSize.current! - primarySizeRef.current - handleSize;
        onSizeChanged?.(parseFloat(firstPaneRef.current!.style.flexGrow), primarySizeRef.current, secondPanePixels);
      }
    }
  }, [onSizeChanged, handleSize]);

  const styles = useStyles2(getStyles, direction);
  const dragStyles = useStyles2(getDragStyles, dragPosition);
  const dragHandleStyle = direction === 'column' ? dragStyles.dragHandleHorizontal : dragStyles.dragHandleVertical;
  const id = useId();

  const primaryStyles: React.CSSProperties = {
    flexGrow: clamp(initialSize, 0, 1),
    [minDimProp]: 'min-content',
  };

  const secondaryStyles: React.CSSProperties = {
    flexGrow: clamp(1 - initialSize, 0, 1),
    [minDimProp]: 'min-content',
  };

  if (usePixels) {
    primaryStyles.flexGrow = 1;
    secondaryStyles.flexGrow = 'unset';
    secondaryStyles.flexBasis = `${initialSize}px`;
  }

  return {
    containerProps: {
      ref: containerRef,
      className: styles.container,
    },
    primaryProps: {
      ref: firstPaneRef,
      className: styles.panel,
      style: primaryStyles,
    },
    secondaryProps: {
      ref: secondPaneRef,
      className: styles.panel,
      style: secondaryStyles,
    },
    splitterProps: {
      onPointerUp,
      onPointerDown,
      onPointerMove,
      onKeyDown,
      onKeyUp,
      onDoubleClick,
      onBlur,
      ref: splitterRef,
      style: { [measurementProp]: `${handleSize}px` },
      role: 'separator',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': initialSize * 100,
      'aria-controls': `start-panel-${id}`,
      'aria-label': 'Pane resize widget',
      tabIndex: 0,
      className: dragHandleStyle,
    },
  };
}

function ariaValue(value: number, min: number, max: number) {
  return `${clamp(((value - min) / (max - min)) * 100, 0, 100)}`;
}

interface MeasureResult {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

function measureElement<T extends HTMLElement>(ref: T, usePixels?: boolean): MeasureResult {
  const savedBodyOverflow = document.body.style.overflow;
  const savedWidth = ref.style.width;
  const savedHeight = ref.style.height;
  const savedFlex = ref.style.flexGrow;
  const savedFlexBasis = ref.style.flexBasis;

  document.body.style.overflow = 'hidden';

  ref.style.flexGrow = '0';
  ref.style.flexBasis = '0';

  const { width: minWidth, height: minHeight } = ref.getBoundingClientRect();

  ref.style.flexGrow = '100';

  const { width: maxWidth, height: maxHeight } = ref.getBoundingClientRect();

  document.body.style.overflow = savedBodyOverflow;

  ref.style.width = savedWidth;
  ref.style.height = savedHeight;
  ref.style.flexGrow = savedFlex;
  ref.style.flexBasis = savedFlexBasis;

  return { minWidth, maxWidth, minHeight, maxHeight };
}

function getStyles(theme: GrafanaTheme2, direction: UseSplitterOptions['direction']) {
  return {
    container: css({
      display: 'flex',
      flexDirection: direction === 'row' ? 'row' : 'column',
      width: '100%',
      flexGrow: 1,
      overflow: 'hidden',
    }),
    panel: css({ display: 'flex', position: 'relative', flexBasis: 0 }),
  };
}

function getPixelSize(size: ComponentSize = 'md') {
  return {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 32,
  }[size];
}
