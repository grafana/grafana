import { css, cx } from '@emotion/css';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useSyncExternalStore,
} from 'react';
import { useMeasure } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { LazyLoader, type SceneGridItemLike, type SceneGridLayout } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../../utils/clone';
import { DASHBOARD_DROP_TARGET_KEY_ATTR } from '../../types/DashboardDropTarget';

import {
  type CustomGridController,
  type CustomGridInteraction,
  DRAG_LEFT_VAR,
  DRAG_TOP_VAR,
  GRID_ITEM_KEY_ATTR,
  NARROW_GRID_MAX_WIDTH,
  RESIZE_HEIGHT_VAR,
  RESIZE_WIDTH_VAR,
} from './CustomGridController';
import { getLayoutKey } from './gridItemLayout';
import { containerHeightPx, type GridLayoutItem, type PixelRect, pixelRectFor } from './gridMath';

export const CUSTOM_GRID_ATTR = 'data-custom-grid';

interface Props {
  grid: SceneGridLayout;
  controller: CustomGridController;
  /** Key the grid is found by as a drop target, for its own items and items dragged in from elsewhere */
  dropTargetKey?: string;
}

/**
 * Renders a custom grid without react-grid-layout: every grid item is absolutely positioned at the cell
 * the controller's layout gives it. The grid items render themselves, so panels look the same as in the
 * react-grid-layout grid.
 */
export function CustomGridRenderer({ grid, controller, dropTargetKey }: Props) {
  const { children, isLazy, isResizable } = grid.useState();
  const layout = useSyncExternalStore(controller.subscribe, controller.getLayout);
  const interaction = useSyncExternalStore(controller.subscribe, controller.getInteraction);
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  const styles = useStyles2(getStyles);

  const isNarrow = width > 0 && width < NARROW_GRID_MAX_WIDTH;
  const rendered = isNarrow ? controller.getNarrowLayout() : (interaction?.preview ?? layout);
  const isDragging = interaction?.kind === 'drag';

  // react-grid-layout does not report the full width layout of narrow grids either
  useEffect(() => {
    if (width > 0 && !isNarrow) {
      controller.syncGridItems();
    }
  }, [controller, layout, width, isNarrow]);

  const positions = new Map(rendered.map((item) => [item.i, item]));
  const placeholder = interaction?.isActive && !interaction.isOutside ? positions.get(interaction.key) : undefined;

  return (
    <div
      ref={measureRef}
      className={cx(styles.wrapper, isDragging && styles.wrapperDragging)}
      {...{ [CUSTOM_GRID_ATTR]: '' }}
    >
      {width > 0 && (
        <div
          ref={controller.setContainer}
          className={styles.container}
          style={{ width, height: containerHeightPx(rendered) }}
          {...(dropTargetKey ? { [DASHBOARD_DROP_TARGET_KEY_ATTR]: dropTargetKey } : {})}
        >
          {placeholder && <div className={styles.placeholder} style={toStyle(pixelRectFor(width, placeholder))} />}
          {children.map((child) => {
            const layoutKey = getLayoutKey(child);
            const item = positions.get(layoutKey);
            const state = interaction?.isActive && interaction.key === layoutKey ? interaction : undefined;
            // The dragged item stays rendered while it is outside the grid, following the pointer
            if (!item && state?.kind !== 'drag') {
              return null;
            }

            return (
              <CustomGridItem
                key={child.state.key}
                gridItem={child}
                style={getItemStyle(width, item, state)}
                isLazy={!!isLazy}
                interaction={state?.kind}
                onResizeStart={
                  !isNarrow && isResizable && child.state.isResizable !== false && !isRepeatCloneOrChildOf(child)
                    ? (evt) => controller.startResize(evt, child)
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function getItemStyle(
  width: number,
  item: GridLayoutItem | undefined,
  interaction: CustomGridInteraction | undefined
): CSSProperties {
  const rect = item ? pixelRectFor(width, item) : undefined;

  if (interaction?.kind === 'drag') {
    const { startSize } = interaction;
    // In viewport coordinates, see `dragged`
    return {
      width: startSize.width,
      height: startSize.height,
      transform: `translate(var(${DRAG_LEFT_VAR}, 0px), var(${DRAG_TOP_VAR}, 0px))`,
    };
  }

  if (interaction?.kind === 'resize' && rect) {
    return {
      width: `var(${RESIZE_WIDTH_VAR}, ${rect.width}px)`,
      height: `var(${RESIZE_HEIGHT_VAR}, ${rect.height}px)`,
      transform: `translate(${rect.left}px, ${rect.top}px)`,
    };
  }

  return rect ? toStyle(rect) : {};
}

function toStyle(rect: PixelRect): CSSProperties {
  return { width: rect.width, height: rect.height, transform: `translate(${rect.left}px, ${rect.top}px)` };
}

interface CustomGridItemProps {
  gridItem: SceneGridItemLike;
  style: CSSProperties;
  isLazy: boolean;
  interaction: CustomGridInteraction['kind'] | undefined;
  onResizeStart: ((evt: ReactPointerEvent) => void) | undefined;
}

function CustomGridItem({ gridItem, style, isLazy, interaction, onResizeStart }: CustomGridItemProps) {
  const styles = useStyles2(getStyles);
  const key = gridItem.state.key!;
  const className = cx(
    styles.item,
    gridItem.getClassName?.(),
    interaction === 'drag' && styles.dragged,
    interaction === 'resize' && styles.resizing
  );
  const attributes = { [GRID_ITEM_KEY_ATTR]: key };

  const content: ReactNode = (
    <>
      <gridItem.Component model={gridItem} />
      {onResizeStart && interaction !== 'drag' && <ResizeHandle onPointerDown={onResizeStart} />}
    </>
  );

  // Same wrapper as the react-grid-layout grid, which queries only the panels in view
  if (isLazy) {
    return (
      <LazyLoader key={key} {...attributes} className={className} style={style} mode="query">
        {content}
      </LazyLoader>
    );
  }

  return (
    <div {...attributes} className={className} style={style}>
      {content}
    </div>
  );
}

// Same markup and class as the react-grid-layout grid's handle
function ResizeHandle({ onPointerDown }: { onPointerDown: (evt: ReactPointerEvent) => void }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.resizeHandle, 'scene-resize-handle')} onPointerDown={onPointerDown}>
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
    // Same as the react-grid-layout grid's wrapper; the layout manager's styles rely on it being the
    // first child of the layout container
    wrapper: css({
      flex: '1 1 auto',
      position: 'relative',
      zIndex: 1,
      width: '100%',
    }),
    // Every grid is its own stacking context, so the grid of a dragged panel is lifted above the others
    // for the panel to stay visible over them
    wrapperDragging: css({
      zIndex: theme.zIndex.dropdown,
    }),
    container: css({
      position: 'relative',
      [theme.breakpoints.down('md')]: {
        height: 'unset !important',
      },
    }),
    item: css({
      position: 'absolute',
      top: 0,
      left: 0,
      boxSizing: 'border-box',
      '&:hover > .scene-resize-handle': {
        visibility: 'visible',
      },
      // On small screens panels are stacked in reading order, like the global react-grid-layout styles do
      [theme.breakpoints.down('md')]: {
        display: 'block !important',
        transitionProperty: 'none !important',
        // can't avoid type assertion here due to !important
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        position: 'unset !important' as 'unset',
        transform: 'translate(0px, 0px) !important',
        marginBottom: theme.spacing(2),
        '&.panel-repeater-grid-item': {
          height: 'auto !important',
        },
      },
    }),
    // Same as the react-grid-layout grid's dragged item. It must not hide the drop targets under the pointer.
    // Fixed, so it stays under the pointer while the dashboard scrolls and is not clipped by its scroll container.
    dragged: css({
      position: 'fixed',
      zIndex: theme.zIndex.dropdown,
      opacity: 0.8,
      pointerEvents: 'none',
    }),
    resizing: css({
      zIndex: theme.zIndex.dropdown,
    }),
    // Same as the react-grid-layout grid's placeholder
    placeholder: css({
      position: 'absolute',
      top: 0,
      left: 0,
      boxShadow: `0 0 4px ${theme.colors.accent.main}`,
      borderRadius: theme.shape.radius.lg,
      background: theme.colors.accent.transparent,
      pointerEvents: 'none',
    }),
    resizeHandle: css({
      position: 'absolute',
      bottom: 0,
      right: 0,
      zIndex: 999,
      // visibility rather than display, so showing it does not cause flicker
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
    }),
  };
}
