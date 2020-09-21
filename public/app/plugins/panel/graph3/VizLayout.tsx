import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { css } from 'emotion';
import { useMeasure } from './useMeasure';
import { LayoutBuilder, LayoutRendererComponent } from './LayoutBuilder';
import { CustomScrollbar } from '@grafana/ui';

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
const VizLayoutRenderer: LayoutRendererComponent<VizLayoutSlots> = ({ slots, refs, width, height }) => {
  return (
    <div
      className={css`
        height: ${height}px;
        width: ${width}px;
        display: flex;
        flex-grow: 1;
        flex-direction: column;
      `}
    >
      {slots.top && (
        <div
          ref={refs.top}
          className={css`
            width: 100%;
            max-height: 35%;
            align-self: top;
          `}
        >
          <CustomScrollbar>{slots.top}</CustomScrollbar>
        </div>
      )}

      {(slots.left || slots.right || slots.canvas) && (
        <div
          className={css`
            label: INNER;
            display: flex;
            flex-direction: row;
            width: 100%;
            height: 100%;
          `}
        >
          {slots.left && (
            <div
              ref={refs.left}
              className={css`
                max-height: 100%;
              `}
            >
              <CustomScrollbar>{slots.left}</CustomScrollbar>
            </div>
          )}
          {slots.canvas && <div>{slots.canvas}</div>}
          {slots.right && (
            <div
              ref={refs.right}
              className={css`
                max-height: 100%;
              `}
            >
              <CustomScrollbar>{slots.right}</CustomScrollbar>
            </div>
          )}
        </div>
      )}
      {slots.bottom && (
        <div
          ref={refs.bottom}
          className={css`
            width: 100%;
            max-height: 35%;
          `}
        >
          <CustomScrollbar>{slots.bottom}</CustomScrollbar>
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

  // public fluent API exposed via render prop to build the layout
  const builder = useMemo(
    () =>
      new LayoutBuilder(
        VizLayoutRenderer,
        {
          top: topSlotRef,
          bottom: bottomSlotRef,
          left: leftSlotRef,
          right: rightSlotRef,
          canvas: canvasSlotRef,
        },
        width,
        height
      ),
    [bottomSlotBBox, topSlotBBox, leftSlotBBox, rightSlotBBox, width, height]
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

    const nextState = {
      // first, reset all bboxes to defaults
      ...DEFAULT_VIZ_LAYOUT_STATE,
      // set layout to ready
      isReady: true,
      // update state with active slot bboxes
      ...nextDimensions,
    };

    setDimensions(nextState);
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
        overflow: hidden;
      `}
    >
      {children({
        builder: builder,
        getLayout,
      })}
    </div>
  );
};
