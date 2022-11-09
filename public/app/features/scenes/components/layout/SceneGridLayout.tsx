import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';
import ReactGridLayout from 'react-grid-layout';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import {
  SceneComponentProps,
  SceneLayoutChild,
  SceneLayoutChildState,
  SceneLayoutState,
  SceneObject,
  SceneObjectSize,
} from '../../core/types';
import { SceneDragHandle } from '../SceneDragHandle';

interface SceneGridLayoutState extends SceneLayoutState {}

export class SceneGridLayout extends SceneObjectBase<SceneGridLayoutState> {
  static Component = SceneGridLayoutRenderer;

  private _flattenedChildren: Record<string, { row?: SceneGridRow; child: SceneLayoutChild }> = {};
  private _rowBBoxes: Record<string, { x: number; y: number; height: number }> = {};

  private _skipOnLayoutChange = false;
  constructor(state: SceneGridLayoutState) {
    super({
      isDraggable: true,
      ...state,
    });

    // Flat record of all layout children
    this._flattenedChildren = flattenGridLayoutChildren(this.state.children);

    // Bounding boxes for each row
    this._rowBBoxes = buildRowBBoxes(this.state.children);
  }

  get flattenedChildren() {
    return this._flattenedChildren;
  }
  get rowBBoxes() {
    return this._rowBBoxes;
  }

  updateLayout() {
    this._flattenedChildren = flattenGridLayoutChildren(this.state.children);
    this._rowBBoxes = buildRowBBoxes(this.state.children);

    // Force a re-render
    this.setState({
      children: [...this.state.children],
    });
  }

  onLayoutChange = (layout: ReactGridLayout.Layout[]) => {
    if (this._skipOnLayoutChange) {
      // Layout has been updated by other RTL handler already
      this._skipOnLayoutChange = false;
      return;
    }

    for (const item of layout) {
      const child = this.state.children.find((c) => c.state.key === item.i);
      if (child) {
        const nextSize = {
          x: item.x,
          y: item.y,
          width: item.w,
          height: item.h,
        };
        if (!isItemSizeEqual(child.state.size!, nextSize)) {
          child.setState({
            size: {
              ...child.state.size,
              ...nextSize,
            },
          });
        }
      }
    }
    this.setState({ children: [...this.state.children] });
    this._flattenedChildren = flattenGridLayoutChildren(this.state.children);
  };

  onResizeStop: ReactGridLayout.ItemCallback = (_, o, n) => {
    const child = this.flattenedChildren[n.i];
    if (!child) {
      return;
    }
    child.child.setState({
      size: {
        ...child.child.state.size,
        width: n.w,
        height: n.h,
      },
    });
  };

  onDragStop: ReactGridLayout.ItemCallback = (l, o, n) => {
    const layoutProcessedSize: string[] = [];

    const activeRows: Record<
      string,
      {
        x: number;
        y: number;
        height: number;
      }
    > = {};

    for (const rowKey in this._rowBBoxes) {
      if (this.flattenedChildren[rowKey] && this.flattenedChildren[rowKey].child.state.isCollapsed) {
        continue;
      }
      activeRows[rowKey] = this._rowBBoxes[rowKey];
    }

    const source = this.flattenedChildren[n.i];
    let target: SceneLayoutChild | null = null;

    // detect dropped item colisions with active rows
    if (Object.keys(activeRows).length !== 0) {
      for (const rowKey in activeRows) {
        const row = activeRows[rowKey];
        if (n.y > row.y && n.y <= row.y + row.height) {
          target = this.flattenedChildren[rowKey].child!;
          console.log(n.i, 'fits', rowKey);
        }
      }
    }

    // If dropped into a row...
    if (target) {
      // update source child size realtive to target row
      source.child.setState({
        size: {
          ...source.child.state.size,
          x: n.x,
          y: n.y - target.state.size!.y! - 1,
        },
      });

      // skip size update later on
      layoutProcessedSize.push(n.i);

      // add child to new target row
      target.setState({
        children: [...target.state.children, source.child],
      });

      // if source cell was comining from a different row
      if (source.row && source.row !== target) {
        console.log('comes from a row', source.row.state.key);
        source.row.setState({
          children: source.row.state.children.filter((c) => c.state.key !== n.i),
        });
      } else {
        // remove child from layout
        this.setState({
          children: this.state.children.filter((c) => c.state.key !== n.i),
        });
      }
    } else {
      // If dropped on a grid, but not into a row
      source.child.setState({
        size: {
          ...source.child.state.size,
          x: n.x,
          y: n.y,
        },
      });
      // skip size update later on
      layoutProcessedSize.push(n.i);

      if (source.row) {
        // if source cell was comining from a row, remove it from it
        source.row.setState({
          children: source.row.state.children.filter((c) => c.state.key !== n.i),
        });
        // add moved cell to layout
        this.setState({
          children: [...this.state.children, source.child],
        });
      } else {
        console.log('Moving cell on top level grid');
      }
    }

    // Update children positions if they have changed
    for (let i = 0; i < l.length; i++) {
      if (layoutProcessedSize.includes(l[i].i)) {
        continue;
      }
      const childDef = this.flattenedChildren[l[i].i];
      const child = childDef.child;
      const row = childDef.row;
      const childSize = childDef.child.state.size;
      const childLayout = l[i];

      if (childSize?.x !== childLayout.x || childSize?.y !== childLayout.y) {
        child.setState({
          size: {
            ...child.state.size,
            x: childLayout.x,
            y: row ? childLayout.y - row.state.size!.y! - 1 : childLayout.y,
          },
        });
      }
    }

    // Skipping onLayoutChange handler to avoid unnecessary re-renders
    this._skipOnLayoutChange = true;
    this.updateLayout();
  };
}

function SceneGridLayoutRenderer({ model }: SceneComponentProps<SceneGridLayout>) {
  const theme = useTheme2();
  const { children } = model.useState();
  validateChildrenSize(children);

  const layout = useMemo(() => {
    let topLevelCells: ReactGridLayout.Layout[] = [];
    const perRowCells: Record<string, ReactGridLayout.Layout[]> = {};

    Object.values(model.flattenedChildren).forEach((child) => {
      const size = child.child.state.size!;

      if (!child.row) {
        // rendering cells and row
        let isDraggable = Boolean(child.child.state.isDraggable);
        let isResizable = Boolean(child.child.state.isResizable);
        if (child.child instanceof SceneGridRow) {
          isDraggable = child.child.state.isCollapsed ? true : false;
          isResizable = false;
        }
        topLevelCells.push({
          i: child.child.state.key!,
          x: size.x!,
          y: size.y!,
          w: size.width!,
          h: size.height!,
          isResizable,
          isDraggable,
        });
      } else {
        // Rendering row children
        let isDraggable = Boolean(child.child.state.isDraggable);
        let isResizable = Boolean(child.child.state.isResizable);
        const cell = {
          i: child.child.state.key!,
          x: size.x!,
          // y: size.y!,
          y: size.y! + child.row.state.size!.y!,
          w: size.width!,
          h: size.height!,
          isResizable,
          isDraggable,
        };
        if (perRowCells[child.row.state.key!]) {
          perRowCells[child.row.state.key!].push(cell);
        } else {
          perRowCells[child.row.state.key!] = [cell];
        }
      }
    });

    topLevelCells = topLevelCells.sort((panelA, panelB) => {
      if (panelA.y === panelB.y) {
        return panelA.x - panelB.x;
      } else {
        return panelA.y - panelB.y;
      }
    });
    // sort sub row cells
    for (const rowKey in perRowCells) {
      perRowCells[rowKey] = perRowCells[rowKey].sort((panelA, panelB) => {
        if (panelA.y === panelB.y) {
          return panelA.x - panelB.x;
        } else {
          return panelA.y - panelB.y;
        }
      });
    }

    const lg = topLevelCells.reduce<ReactGridLayout.Layout[]>((acc, cell) => {
      if (perRowCells[cell.i]) {
        return [...acc, cell, ...perRowCells[cell.i]];
      }
      return [...acc, cell];
    }, []);

    return { lg, sm: lg.map((l) => ({ ...l, w: 24 })) };
  }, [model.flattenedChildren]);

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
              useCSSTransforms={true}
              margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
              cols={GRID_COLUMN_COUNT}
              rowHeight={GRID_CELL_HEIGHT}
              draggableHandle={`.grid-drag-handle-${model.state.key}`}
              // @ts-ignore: ignoring for now until we make the size type numbers-only
              layout={width > 768 ? layout.lg : layout.sm}
              onDragStop={model.onDragStop}
              // onDrag={model.onDrag}
              onResizeStop={model.onResizeStop}
              onLayoutChange={model.onLayoutChange}
              isBounded={false}
              // compactType={null}
            >
              {Object.values(model.flattenedChildren).map((child) => {
                if (child.row && child.row.state.isCollapsed) {
                  return null;
                }
                return (
                  <div key={child.child.state.key} style={{ display: 'flex' }}>
                    <child.child.Component model={child.child} key={child.child.state.key} />
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

interface SceneGridRowState extends SceneLayoutChildState {
  title: string;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  children: Array<SceneObject<SceneLayoutChildState>>;
}

export class SceneGridRow extends SceneObjectBase<SceneGridRowState> {
  static Component = SceneGridRowRenderer;
  // private _originalHeight = 0;

  constructor(state: SceneGridRowState) {
    super({
      isResizable: false,
      isDraggable: true,
      isCollapsible: true,
      ...state,
      size: {
        ...state.size,
        x: 0,
        height: 1,
        width: GRID_COLUMN_COUNT,
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
        this.setState({ isCollapsed: false });
      } else {
        this.setState({ isCollapsed: true });
      }
      layout.updateLayout();
    }
  };
}

function SceneGridRowRenderer({ model }: SceneComponentProps<SceneGridRow>) {
  const styles = useStyles2(getSceneGridRowStyles);
  const { isCollapsible, isCollapsed, isDraggable, title, ...state } = model.useState();
  const layout = model.getLayout();
  const dragHandle = <SceneDragHandle layoutKey={layout.state.key!} />;

  return (
    <div className={styles.row}>
      <div className={cx(styles.rowHeader, isCollapsed && styles.rowHeaderCollapsed)}>
        <div onClick={model.onCollapseToggle} className={styles.rowTitleWrapper}>
          {isCollapsible && <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />}
          <span className={styles.rowTitle}>{title}</span>
        </div>
        {isDraggable && isCollapsed && <div>{dragHandle}</div>}
      </div>
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

function validateChildrenSize(children: SceneLayoutChild[]) {
  if (
    children.find(
      (c) =>
        !c.state.size ||
        c.state.size.height === undefined ||
        c.state.size.width === undefined ||
        c.state.size.x === undefined ||
        c.state.size.y === undefined
    )
  ) {
    throw new Error('All children must have a size specified');
  }
}

/**
 * Given a list of GridLayout children will flatten it and keep references to the row if a child comes from one
 */
function flattenGridLayoutChildren(
  children: SceneLayoutChild[]
): Record<string, { row?: SceneGridRow; child: SceneLayoutChild }> {
  let flattenedChildren: Record<string, { row?: SceneGridRow; child: SceneLayoutChild }> = {};

  for (const child of children) {
    if (child instanceof SceneGridRow) {
      // row is perceived as a flat child of the grid layout
      flattenedChildren[child.state.key!] = { child };

      if (!child.state.isCollapsed) {
        // all row children are perceived as flat children of the grid layout
        const rowChildren = flattenGridLayoutChildren(child.state.children);

        for (const key in rowChildren) {
          rowChildren[key] = { ...rowChildren[key], row: child };
        }
        flattenedChildren = { ...flattenedChildren, ...rowChildren };
      }
    } else {
      flattenedChildren[child.state.key!] = { child };
    }
  }

  return flattenedChildren;
}

function buildRowBBoxes(children: SceneLayoutChild[]) {
  const rowBBoxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
  for (const child of children) {
    if (child instanceof SceneGridRow) {
      const x = 0;
      const y = child.state.size?.y!;
      const width = 24;
      const heights = [];
      for (const rowChildren of child.state.children) {
        heights.push(rowChildren.state.size?.height! + rowChildren.state.size?.y!);
      }

      const height = heights.length ? Math.max(...heights) + 1 : 1;
      rowBBoxes[child.state.key!] = { x, y, width, height };
    }
  }

  return rowBBoxes;
}

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

function isItemSizeEqual(a: SceneObjectSize, b: SceneObjectSize) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
