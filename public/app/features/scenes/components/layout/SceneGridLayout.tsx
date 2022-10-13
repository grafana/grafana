import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';
import ReactGridLayout from 'react-grid-layout';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';
import { DEFAULT_ROW_HEIGHT, GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutState } from '../../core/types';

interface SceneGridLayoutState extends SceneLayoutState {
  children: Array<SceneGridCell | SceneGridRow>;
}

type GridCellLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class SceneGridLayout extends SceneObjectBase<SceneGridLayoutState> {
  static Component = SceneGridLayoutRenderer;

  updateLayout() {
    this.setState({
      children: [...this.state.children],
    });
  }

  onResizeStop: ReactGridLayout.ItemCallback = (_, o, n) => {
    const child = this.state.children.find((c) => c.state.key === n.i);
    if (!child) {
      return;
    }
    child.setState({
      size: {
        ...child.state.size,
        width: n.w,
        height: n.h,
      },
    });
  };

  // When layout changes, figure out if it's a nested grid layout and update enclosing cell's size if needed
  onLayoutChange = (layout: ReactGridLayout.Layout[]) => {
    let enclosingCell;
    let parent = this.parent;
    while (parent) {
      if (parent instanceof SceneGridCell || parent instanceof SceneGridRow) {
        enclosingCell = parent;
        break;
      } else {
        parent = parent.parent;
      }
    }

    // When not nested, we don't need to update anything
    if (!enclosingCell) {
      return;
    }

    // Collect all cells accumulated heights (cell's y position + height)
    const accH = [];
    for (let i = 0; i < layout.length; i++) {
      const c = layout[i];
      accH.push(c.y + c.h);
    }

    // If enclosing cell size is different than updated layout height, resize it accordingly
    if (enclosingCell.state.size.height !== Math.max(...accH)) {
      const diff = Math.max(...accH) - enclosingCell.state.size.height;
      enclosingCell.setState({
        size: {
          ...enclosingCell.state.size,
          height: enclosingCell.state.size.height + diff + (enclosingCell instanceof SceneGridRow ? 1 : 0),
        },
      });
      // Update parent layout
      if (enclosingCell.parent && enclosingCell.parent instanceof SceneGridLayout) {
        enclosingCell.parent.updateLayout();
      }
    }
  };

  onDragStop: ReactGridLayout.ItemCallback = (l, o, n) => {
    // Update children positions if they have changed
    for (let i = 0; i < l.length; i++) {
      const child = this.state.children[i];
      const childSize = child.state.size;
      const childLayout = l[i];
      if (
        childSize?.x !== childLayout.x ||
        childSize?.y !== childLayout.y ||
        childSize?.width !== childLayout.w ||
        childSize?.height !== childLayout.h
      ) {
        child.setState({
          size: {
            ...child.state.size,
            x: childLayout.x,
            y: childLayout.y,
          },
        });
      }
    }

    this.updateLayout();
  };

  getDragHandle(): JSX.Element {
    return <SceneGridDragHandle className={`grid-drag-handle-${this.state.key}`} />;
  }
}

function SceneGridLayoutRenderer({ model }: SceneComponentProps<SceneGridLayout>) {
  const { children } = model.useState();
  const theme = useTheme2();
  const layout = useMemo(() => {
    const lg = children.map((child) => {
      const size = child.state.size;

      const resizeHandles: ReactGridLayout.Layout['resizeHandles'] =
        child instanceof SceneGridRow && Boolean(child.state.isResizable) ? ['s'] : undefined;

      return {
        i: child.state.key!,
        x: size.x,
        y: size.y,
        w: size.width,
        h: size.height,
        isResizable: Boolean(child.state.isResizable),
        isDraggable: Boolean(child.state.isDraggable),
        resizeHandles,
      };
    });

    return { lg, sm: lg.map((l) => ({ ...l, w: 24 })) };
  }, [children]);

  return (
    <AutoSizer disableHeight>
      {({ width }) => {
        if (width === 0) {
          return null;
        }

        // Dev only, to be removed
        const background = generateGridBackground({
          cellSize: { width: (width - 23 * GRID_CELL_VMARGIN) / 24, height: GRID_CELL_HEIGHT },
          margin: [GRID_CELL_VMARGIN, GRID_CELL_VMARGIN],
          cols: 24,
          gridWidth: width,
          theme,
        });

        return (
          /**
           * The children is using a width of 100% so we need to guarantee that it is wrapped
           * in an element that has the calculated size given by the AutoSizer. The AutoSizer
           * has a width of 0 and will let its content overflow its div.
           */
          <div style={{ width: `${width}px`, height: '100%', background }}>
            <ReactGridLayout
              width={width}
              /*
                  Disable draggable if mobile device, solving an issue with unintentionally
                  moving panels. https://github.com/grafana/grafana/issues/18497
                  theme.breakpoints.md = 769
                */
              isDraggable={width > 768}
              isResizable={false}
              containerPadding={[0, 0]}
              useCSSTransforms={false}
              margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
              cols={GRID_COLUMN_COUNT}
              rowHeight={GRID_CELL_HEIGHT}
              draggableHandle={`.grid-drag-handle-${model.state.key}`}
              layout={width > 768 ? layout.lg : layout.sm}
              onDragStop={model.onDragStop}
              onResizeStop={model.onResizeStop}
              onLayoutChange={model.onLayoutChange}
              isBounded={true}
            >
              {children.map((child) => {
                /* eslint-disable-next-line */
                const childProps: SceneGridCellRendererProps<any> = {
                  model: child,
                  isLayoutDraggable: width > 768,
                };

                return (
                  <div key={child.state.key}>
                    <child.Component {...childProps} key={child.state.key} />
                  </div>
                );
              })}
            </ReactGridLayout>
          </div>
        );
      }}
    </AutoSizer>
  );
}

interface SceneGridCellState extends Omit<SceneLayoutState, 'size'> {
  isResizable?: boolean;
  isDraggable?: boolean;
  size: GridCellLayout;
}

export class SceneGridCell extends SceneObjectBase<SceneGridCellState> {
  static Component = SceneGridCellRenderer;
  getLayout = (): SceneGridLayout => {
    if (this.parent instanceof SceneGridLayout) {
      return this.parent;
    }
    throw new Error('SceneGridCell must be a child of SceneGridLayout');
  };
}

interface SceneGridCellRendererProps<T> extends SceneComponentProps<T> {
  isLayoutDraggable?: boolean;
}

function SceneGridCellRenderer(props: SceneGridCellRendererProps<SceneGridCell>) {
  const state = props.model.useState();
  const isDraggable = Boolean(props.isLayoutDraggable) ? state.isDraggable : false;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }}>
      {/* TODO: This is a temporary solution to make the grid cell draggable*/}
      {isDraggable && props.model.getLayout().getDragHandle()}
      <>
        {props.model.state.children.map((child) => {
          return <child.Component key={child.state.key} model={child} />;
        })}
      </>
    </div>
  );
}

function SceneGridDragHandle({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: '20px',
        height: '20px',
        position: 'absolute',
        top: '5px',
        right: '5px',
        zIndex: 1,
        cursor: 'move',
      }}
    >
      <Icon name="draggabledots" />
    </div>
  );
}

interface SceneGridRowState extends Omit<SceneGridCellState, 'size'> {
  title: string;
  size: GridCellLayout;
  isCollapsible?: boolean;
  isDraggable?: boolean;
  isCollapsed?: boolean;
}

export class SceneGridRow extends SceneObjectBase<SceneGridRowState> {
  static Component = SceneGridRowRenderer;
  private _originalHeight = 0;

  constructor(
    state: Omit<SceneGridRowState, 'size'> & { size: Pick<GridCellLayout, 'x' | 'y' | 'height'> & { width?: number } }
  ) {
    super({
      isResizable: true,
      isDraggable: true,
      isCollapsible: true,
      ...state,
      isCollapsed: Boolean(state.isCollapsed),
      size: {
        ...state.size,
        height: state.isCollapsed ? GRID_CELL_HEIGHT : state.size?.height || DEFAULT_ROW_HEIGHT,
        width: state.size.width || GRID_COLUMN_COUNT,
      },
    });

    this._originalHeight = parseInt(
      (state.isCollapsed ? GRID_CELL_HEIGHT : state.size?.height || DEFAULT_ROW_HEIGHT).toString(),
      10
    );

    this.subs = this.subscribe({
      next: (state) => {
        // Preserve the height of the row to be able to restore it when uncollapsing
        if (
          state.size &&
          state.size.height &&
          state.size.height !== this._originalHeight &&
          state.size?.height !== GRID_CELL_HEIGHT &&
          !state.isCollapsed
        ) {
          this._originalHeight = parseInt(state.size.height?.toString(), 10);
        }
      },
    });
  }

  onCollapseToggle = () => {
    if (!this.state.isCollapsible) {
      return;
    }
    const layout = this.parent;

    if (!layout || !(layout instanceof SceneGridLayout)) {
      throw new Error('SceneGridRow must be a child of SceneGridLayout');
    }

    const { isCollapsed, size } = this.state;
    if (!size) {
      return;
    }

    if (layout) {
      if (isCollapsed) {
        this.setState({ isCollapsed: false, isResizable: true, size: { ...size, height: this._originalHeight } });
      } else {
        this.setState({ isCollapsed: true, isResizable: false, size: { ...size, height: 1 } });
      }
      layout.updateLayout();
    }
  };

  getLayout = (): SceneGridLayout => {
    if (this.parent instanceof SceneGridLayout) {
      return this.parent;
    }
    throw new Error('SceneGridRow must be a child of SceneGridLayout');
  };
}

function SceneGridRowRenderer({ model, isLayoutDraggable }: SceneGridCellRendererProps<SceneGridRow>) {
  const styles = useStyles2(getSceneGridRowStyles);
  const { isCollapsible, isCollapsed, title, ...state } = model.useState();
  const isDraggable = Boolean(isLayoutDraggable) ? state.isDraggable : false;
  return (
    <div className={styles.row}>
      <div className={cx(styles.rowHeader, isCollapsed && styles.rowHeaderCollapsed)}>
        <div onClick={model.onCollapseToggle} className={styles.rowTitleWrapper}>
          {isCollapsible && <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />}
          <span className={styles.rowTitle}>{title}</span>
        </div>
        {isDraggable && <div>{isDraggable && model.getLayout().getDragHandle()}</div>}
      </div>

      {!isCollapsed && (
        <div style={{ flexGrow: 1, height: 'calc(100%-30px)', width: '100%' }}>
          {model.state.children.map((child) => {
            return <child.Component key={child.state.key} model={child} />;
          })}
        </div>
      )}
    </div>
  );
}

const getSceneGridRowStyles = (theme: GrafanaTheme2) => {
  return {
    row: css({
      width: '100%',
      height: '100%',
      position: 'relative',
      zIndex: 0,
      display: 'flex',
      flexDirection: 'column',
    }),
    rowHeader: css({
      width: '100%',
      height: '30px',
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '8px',
      border: `1px solid transparent`,
    }),
    rowTitleWrapper: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
    }),
    rowHeaderCollapsed: css({
      marginBottom: '0px',
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.borderRadius(1),
    }),
    rowTitle: css({
      fontSize: theme.typography.h6.fontSize,
      fontWeight: theme.typography.h6.fontWeight,
    }),
  };
};

// Source: https://github.com/metabase/metabase/blob/master/frontend/src/metabase/dashboard/components/grid/utils.js#L28
// © 2022 Metabase, Inc.
export function generateGridBackground({
  cellSize,
  margin,
  cols,
  gridWidth,
  theme,
}: {
  cellSize: { width: number; height: number };
  margin: [number, number];
  cols: number;
  gridWidth: number;
  theme: GrafanaTheme2;
}) {
  const XMLNS = 'http://www.w3.org/2000/svg';
  const [horizontalMargin, verticalMargin] = margin;
  const rowHeight = cellSize.height + verticalMargin;
  const cellStrokeColor = theme.colors.border.weak;

  const y = 0;
  const w = cellSize.width;
  const h = cellSize.height;

  const rectangles = new Array(cols).fill(undefined).map((_, i) => {
    const x = i * (cellSize.width + horizontalMargin);
    return `<rect stroke='${cellStrokeColor}' stroke-width='1' fill='none' x='${x}' y='${y}' width='${w}' height='${h}'/>`;
  });

  const svg = [`<svg xmlns='${XMLNS}' width='${gridWidth}' height='${rowHeight}'>`, ...rectangles, `</svg>`].join('');

  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
