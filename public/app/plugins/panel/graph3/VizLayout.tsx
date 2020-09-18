import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { css } from 'emotion';
import { useMeasure } from './useMeasure';
import { LayoutBuilder, LayoutRendererComponent } from './LayoutBuilder';

type UseMeasureRect = Pick<DOMRectReadOnly, 'x' | 'y' | 'top' | 'left' | 'right' | 'bottom' | 'height' | 'width'>;

const RESET_DIMENSIONS: UseMeasureRect = {
  x: 0,
  y: 0,
  height: 0,
  width: 0,
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const DEFAULT_VIZ_LAYOUT_STATE = {
  isReady: false,
  top: RESET_DIMENSIONS,
  bottom: RESET_DIMENSIONS,
  right: RESET_DIMENSIONS,
  left: RESET_DIMENSIONS,
  canvas: RESET_DIMENSIONS,
};

export type VizLayoutSlots = 'top' | 'bottom' | 'left' | 'right' | 'canvas';

export interface VizLayoutState extends Record<VizLayoutSlots, UseMeasureRect> {
  isReady: boolean;
}

interface VizLayoutAPI {
  builder: LayoutBuilder<VizLayoutSlots>;
  getLayout: () => VizLayoutState;
}

interface VizLayoutProps {
  width: number;
  height: number;
  children: (api: VizLayoutAPI) => React.ReactNode;
}

/**
 * Graph viz layout. Consists of 5 slots: top(T), bottom(B), left(L), right(R), canvas:
 *
 * +-----------------------------------------------+
 * |                       T                       |
 * ----|---------------------------------------|----
 * |   |                                       |   |
 * |   |                                       |   |
 * | L |              CANVAS SLOT              | R |
 * |   |                                       |   |
 * |   |                                       |   |
 * ----|---------------------------------------|----
 * |                       B                       |
 * +-----------------------------------------------+
 *
 */
const VizLayoutRenderer: LayoutRendererComponent<VizLayoutSlots> = ({ slots, refs }) => {
  return (
    <div
      className={css`
        height: 100%;
        display: flex;
        sflex-grow: 1;
        flex-direction: column;
      `}
    >
      {slots.top && <div ref={refs.top}>{slots.top}</div>}

      {(slots.left || slots.right || slots.canvas) && (
        <div
          className={css`
            label: INNER;
            display: flex;
            flex-grow: 1;
            flex-direction: row;
          `}
        >
          {slots.left && <div ref={refs.left}>{slots.left}</div>}
          {slots.canvas && <div>{slots.canvas}</div>}
          {slots.right && <div ref={refs.right}>{slots.right}</div>}
        </div>
      )}
      {slots.bottom && (
        <div
          ref={refs.bottom}
          className={css`
            width: 100%;
            align-self: end;
          `}
        >
          {slots.bottom}
        </div>
      )}
    </div>
  );
};

export const VizLayout: React.FC<VizLayoutProps> = ({ children, width, height }) => {
  /**
   * Layout slots refs & bboxes
   * Refs are passed down to the renderer component by layout builder
   * It's up to the renderer to assign refs to correct slots(which are underlying DOM elements)
   * */
  const [bottomSlotRef, bottomSlotBBox] = useMeasure();
  const [topSlotRef, topSlotBBox] = useMeasure();
  const [leftSlotRef, leftSlotBBox] = useMeasure();
  const [rightSlotRef, rightSlotBBox] = useMeasure();
  const [canvasSlotRef, canvasSlotBBox] = useMeasure();
  const [activeSlots, setActiveSlots] = useState<Record<VizLayoutSlots, HTMLElement | null>>({
    top: null,
    left: null,
    right: null,
    bottom: null,
    canvas: null,
  });

  // public fluent API exposed via render prop to build the layout
  const builder = useMemo(
    () =>
      new LayoutBuilder(VizLayoutRenderer, {
        top: topSlotRef,
        bottom: bottomSlotRef,
        left: leftSlotRef,
        right: rightSlotRef,
        canvas: canvasSlotRef,
      }),
    [bottomSlotBBox, topSlotBBox, leftSlotBBox, rightSlotBBox]
  );

  // memoized map of layout slot bboxes, used for exposing correct bboxes when the layout is ready
  const bboxMap = useMemo(
    () => ({
      top: topSlotBBox,
      bottom: bottomSlotBBox,
      left: leftSlotBBox,
      right: rightSlotBBox,
      canvas: canvasSlotBBox,
    }),
    [bottomSlotBBox, topSlotBBox, leftSlotBBox, rightSlotBBox]
  );

  const [dimensions, setDimensions] = useState<VizLayoutState>(DEFAULT_VIZ_LAYOUT_STATE);

  // when DOM settles we set the layout to be ready to get measurements downstream
  useLayoutEffect(() => {
    // layout is ready by now
    const currentLayout = builder.getLayout();
    // map active layout slots to corresponding bboxes
    let nextDimensions: Partial<Record<VizLayoutSlots, UseMeasureRect>> = {};
    for (const key of Object.keys(currentLayout)) {
      nextDimensions[key as VizLayoutSlots] = bboxMap[key as VizLayoutSlots];
    }

    setDimensions({
      // first, reset all bboxes to defaults
      ...DEFAULT_VIZ_LAYOUT_STATE,
      // set layout to ready
      isReady: true,
      // update state with active slot bboxes
      ...nextDimensions,
    });
  }, [bottomSlotBBox, topSlotBBox, leftSlotBBox, rightSlotBBox, width, height]);

  // returns current state of the layout, bounding rects of all slots to be rendered
  const getLayout = useCallback(() => {
    return dimensions;
  }, [dimensions]);

  return (
    <div
      className={css`
        label: PanelVizLayout;
        width: ${width}px;
        height: ${height}px;
      `}
    >
      {children({ builder: builder, getLayout })}
    </div>
  );
};
