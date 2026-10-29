import { css, cx } from '@emotion/css';
import { type CSSProperties, type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { useMeasure } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { LazyLoader, type SceneGridItemLike, type SceneGridLayout } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../../utils/clone';

import { type CustomGridController } from './CustomGridController';
import { getLayoutKey } from './gridItemLayout';
import { containerHeightPx, type PixelRect, pixelRectFor } from './gridMath';

/** Below this grid width every panel is full width, same as in the react-grid-layout grid */
const NARROW_GRID_MAX_WIDTH = 768;

export const CUSTOM_GRID_ATTR = 'data-custom-grid';

interface Props {
  grid: SceneGridLayout;
  controller: CustomGridController;
}

/**
 * Renders a custom grid without react-grid-layout: every grid item is absolutely positioned at the cell
 * the controller's layout gives it. The grid items render themselves, so panels look the same as in the
 * react-grid-layout grid.
 */
export function CustomGridRenderer({ grid, controller }: Props) {
  const { children, isLazy, isDraggable, isResizable } = grid.useState();
  const layout = useSyncExternalStore(controller.subscribe, controller.getLayout);
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  const styles = useStyles2(getStyles);

  const isNarrow = width > 0 && width < NARROW_GRID_MAX_WIDTH;
  const rendered = isNarrow ? controller.getNarrowLayout() : layout;

  // react-grid-layout does not report the full width layout of narrow grids either
  useEffect(() => {
    if (width > 0 && !isNarrow) {
      controller.syncGridItems();
    }
  }, [controller, layout, width, isNarrow]);

  const positions = new Map(rendered.map((item) => [item.i, item]));

  return (
    <div ref={measureRef} className={styles.wrapper} {...{ [CUSTOM_GRID_ATTR]: '' }}>
      {width > 0 && (
        <div
          className={cx(styles.container, isDraggable && styles.animated)}
          style={{ width, height: containerHeightPx(rendered) }}
        >
          {children.map((child) => {
            const item = positions.get(getLayoutKey(child));
            if (!item) {
              return null;
            }

            return (
              <CustomGridItem
                key={child.state.key}
                gridItem={child}
                rect={pixelRectFor(width, item)}
                isLazy={!!isLazy}
                hasResizeHandle={!!isResizable && child.state.isResizable !== false && !isRepeatCloneOrChildOf(child)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CustomGridItemProps {
  gridItem: SceneGridItemLike;
  rect: PixelRect;
  isLazy: boolean;
  hasResizeHandle: boolean;
}

function CustomGridItem({ gridItem, rect, isLazy, hasResizeHandle }: CustomGridItemProps) {
  const styles = useStyles2(getStyles);
  const key = gridItem.state.key!;
  const className = cx(styles.item, gridItem.getClassName?.());
  const style: CSSProperties = {
    width: rect.width,
    height: rect.height,
    transform: `translate(${rect.left}px, ${rect.top}px)`,
  };

  const content: ReactNode = (
    <>
      <gridItem.Component model={gridItem} />
      {hasResizeHandle && <ResizeHandle />}
    </>
  );

  // Same wrapper as the react-grid-layout grid, which queries only the panels in view
  if (isLazy) {
    return (
      <LazyLoader key={key} data-griditem-key={key} className={className} style={style} mode="query">
        {content}
      </LazyLoader>
    );
  }

  return (
    <div data-griditem-key={key} className={className} style={style}>
      {content}
    </div>
  );
}

// Same markup and class as the react-grid-layout grid's handle. Resizing is not wired up yet.
function ResizeHandle() {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.resizeHandle, 'scene-resize-handle')}>
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
    container: css({
      position: 'relative',
      [theme.breakpoints.down('md')]: {
        height: 'unset !important',
      },
    }),
    animated: css({
      [theme.transitions.handleMotion('no-preference')]: {
        '& > [data-griditem-key]': {
          transition: 'transform 200ms ease',
        },
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
      '&:hover': {
        color: theme.colors.text.link,
      },
      svg: {
        display: 'block',
      },
    }),
  };
}
