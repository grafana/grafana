import { css, cx } from '@emotion/css';
import { type CSSProperties, useEffect, useReducer, useSyncExternalStore } from 'react';
import { type LayoutItem } from 'react-grid-layout-v2/core';
import { useMeasure } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { type SceneGridItemLike, type SceneGridLayout } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

import { DASHBOARD_DROP_TARGET_KEY_ATTR } from '../../types/DashboardDropTarget';

import {
  type CustomGridController,
  DRAG_LEFT_VAR,
  DRAG_TOP_VAR,
  getPanelKey,
  RESIZE_HEIGHT_VAR,
  RESIZE_WIDTH_VAR,
} from './CustomGridController';
import { compact, containerHeightPx, type PixelRect, pixelRectFor } from './gridMath';

/** Same breakpoint the legacy grid used to disable dragging and stack panels */
const MOBILE_MAX_WIDTH = 768;

interface Props {
  grid: SceneGridLayout;
  controller: CustomGridController;
  dropTargetKey?: string;
}

export function CustomGridRenderer({ grid, controller, dropTargetKey }: Props) {
  const { children, isDraggable, isResizable } = grid.useState();
  const view = useSyncExternalStore(controller.subscribe, controller.getViewState);
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  const styles = useStyles2(getStyles);
  useChildPlacementUpdates(children);

  const isMobile = width > 0 && width < MOBILE_MAX_WIDTH;
  const canEdit = !!isDraggable && !isMobile;

  let layout = view.preview ?? controller.getCommittedLayout();
  if (isMobile) {
    layout = compact(layout.map((item) => ({ ...item, x: 0, w: GRID_COLUMN_COUNT })));
  }
  const positions = new Map(layout.map((item) => [item.i, item]));
  const placeholder = view.placeholderKey ? positions.get(view.placeholderKey) : undefined;

  return (
    <div ref={measureRef} className={cx(styles.wrapper, view.draggingKey && styles.wrapperDragging)}>
      {width > 0 && (
        <div
          ref={controller.setContainer}
          className={cx(styles.container, canEdit && styles.animated, view.isDropTarget && 'dashboard-drop-target')}
          style={{ height: containerHeightPx(layout) }}
          {...{ [DASHBOARD_DROP_TARGET_KEY_ATTR]: dropTargetKey }}
        >
          {placeholder && <div className={styles.placeholder} style={toStyle(pixelRectFor(width, placeholder))} />}
          {children.map((child) => {
            const key = getPanelKey(child) ?? child.state.key!;
            const isDragged = view.draggingKey === key;
            const isResizing = view.resizingKey === key;

            return (
              <div
                key={child.state.key}
                data-griditem-key={child.state.key}
                className={cx(
                  styles.item,
                  child.getClassName?.(),
                  isDragged && styles.dragged,
                  isResizing && styles.resizing
                )}
                style={getItemStyle(width, positions.get(key), isDragged, isResizing, view.draggingSize)}
              >
                <child.Component model={child} />
                {canEdit && isResizable && child.state.isResizable !== false && !isDragged && (
                  <ResizeHandle
                    className={styles.resizeHandle}
                    onPointerDown={(evt) => controller.startResize(evt, child)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getItemStyle(
  width: number,
  item: LayoutItem | undefined,
  isDragged: boolean,
  isResizing: boolean,
  draggingSize: { width: number; height: number } | null
): CSSProperties {
  if (isDragged && draggingSize) {
    return {
      width: draggingSize.width,
      height: draggingSize.height,
      transform: `translate(var(${DRAG_LEFT_VAR}), var(${DRAG_TOP_VAR}))`,
    };
  }

  if (!item) {
    return { display: 'none' };
  }

  const rect = pixelRectFor(width, item);
  if (isResizing) {
    return {
      width: `var(${RESIZE_WIDTH_VAR})`,
      height: `var(${RESIZE_HEIGHT_VAR})`,
      transform: `translate(${rect.left}px, ${rect.top}px)`,
    };
  }

  return toStyle(rect);
}

function toStyle(rect: PixelRect): CSSProperties {
  return { width: rect.width, height: rect.height, transform: `translate(${rect.left}px, ${rect.top}px)` };
}

/**
 * The renderer draws positions straight from the children, so it has to re-render when a child
 * changes its placement without the grid's children array changing (e.g. repeats growing an item).
 */
function useChildPlacementUpdates(children: SceneGridItemLike[]) {
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const subs = children.map((child) =>
      child.subscribeToState((next, prev) => {
        if (next.x !== prev.x || next.y !== prev.y || next.width !== prev.width || next.height !== prev.height) {
          forceRender();
        }
      })
    );
    return () => subs.forEach((sub) => sub.unsubscribe());
  }, [children]);
}

function ResizeHandle(props: { className: string; onPointerDown: (evt: React.PointerEvent) => void }) {
  return (
    <div className={props.className} onPointerDown={props.onPointerDown}>
      <svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M21 15L15 21M21 8L8 21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      flex: '1 1 auto',
      position: 'relative',
      zIndex: 1,
      width: '100%',
    }),
    // Every grid is its own stacking context, so the grid that owns the dragged panel has to be
    // lifted above the others for the panel to stay visible while it is dragged over them.
    wrapperDragging: css({
      zIndex: theme.zIndex.dropdown,
    }),
    container: css({
      position: 'relative',
      width: '100%',
    }),
    animated: css({
      [theme.transitions.handleMotion('no-preference')]: {
        '& > [data-griditem-key]': {
          transition: 'transform 200ms ease, width 200ms ease, height 200ms ease',
        },
      },
    }),
    item: css({
      position: 'absolute',
      top: 0,
      left: 0,
      boxSizing: 'border-box',
      '&:hover > .custom-grid-resize-handle': {
        visibility: 'visible',
      },
    }),
    dragged: css({
      zIndex: theme.zIndex.dropdown,
      opacity: 0.8,
      // The drag is tracked by the layout orchestrator through hit testing; the dragged panel
      // sits right under the pointer and must not hide what is below it.
      pointerEvents: 'none',
      [theme.transitions.handleMotion('no-preference')]: {
        '&&': {
          transition: 'none',
        },
      },
    }),
    resizing: css({
      zIndex: theme.zIndex.dropdown,
      [theme.transitions.handleMotion('no-preference')]: {
        '&&': {
          transition: 'none',
        },
      },
    }),
    placeholder: css({
      position: 'absolute',
      top: 0,
      left: 0,
      borderRadius: theme.shape.radius.lg,
      boxShadow: `0 0 4px ${theme.colors.accent.main}`,
      background: theme.colors.accent.transparent,
      pointerEvents: 'none',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'transform 100ms ease, width 100ms ease, height 100ms ease',
      },
    }),
    resizeHandle: cx(
      'custom-grid-resize-handle',
      css({
        position: 'absolute',
        bottom: 0,
        right: 0,
        zIndex: 999,
        visibility: 'hidden',
        padding: theme.spacing(1.5, 0, 0, 1.5),
        color: theme.colors.border.strong,
        cursor: 'se-resize',
        touchAction: 'none',
        '&:hover': {
          color: theme.colors.text.link,
        },
        svg: {
          display: 'block',
        },
      })
    ),
  };
}
