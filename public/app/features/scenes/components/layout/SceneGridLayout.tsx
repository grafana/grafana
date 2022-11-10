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

  private _skipOnLayoutChange = false;

  constructor(state: SceneGridLayoutState) {
    super({
      isDraggable: true,
      ...state,
      children: sortChildrenByPosition(state.children),
    });
  }

  toggleRow(row: SceneGridRow) {
    const isCollapsed = row.state.isCollapsed;

    if (!isCollapsed) {
      row.setState({ isCollapsed: true });
      // To force re-render
      this.setState({});
      return;
    }

    const rowChildren = row.state.children;

    if (rowChildren.length === 0) {
      row.setState({ isCollapsed: false });
      this.setState({});
      return;
    }

    // Ok we are expanding row. We need to update row children y pos (incase they are incorrect) and push items below down
    // Code copied from DashboardModel toggleRow()

    const rowY = row.state.size?.y!;
    const firstPanelYPos = rowChildren[0].state.size?.y ?? rowY;
    const yDiff = firstPanelYPos - (rowY + 1);

    // y max will represent the bottom y pos after all panels have been added
    // needed to know home much panels below should be pushed down
    let yMax = rowY;

    for (const panel of rowChildren) {
      // set the y gridPos if it wasn't already set
      const newSize = { ...panel.state.size };
      newSize.y = newSize.y ?? rowY;
      // make sure y is adjusted (in case row moved while collapsed)
      newSize.y -= yDiff;
      if (newSize.y > panel.state.size?.y!) {
        panel.setState({ size: newSize });
      }
      // update insert post and y max
      yMax = Math.max(yMax, newSize.y + newSize.height!);
      console.log('setting y for panel', panel.state.key, newSize.y);
    }

    const pushDownAmount = yMax - rowY - 1;

    // push panels below down
    for (const child of this.state.children) {
      if (child.state.size?.y! > rowY) {
        this.pushChildDown(child, pushDownAmount);
      }

      if (child instanceof SceneGridRow && child !== row) {
        for (const rowChild of child.state.children) {
          if (rowChild.state.size?.y! > rowY) {
            if (rowChild.state.size?.y! > rowY) {
              this.pushChildDown(rowChild, pushDownAmount);
            }
          }
        }
      }
    }

    row.setState({ isCollapsed: false });
    // Trigger re-render
    this.setState({});
  }

  pushChildDown(child: SceneLayoutChild, amount: number) {
    console.log('pushing down y for panel', child.state.key, child.state.size?.y! + amount);
    child.setState({
      size: {
        ...child.state.size,
        y: child.state.size?.y! + amount,
      },
    });
  }

  onLayoutChange = (layout: ReactGridLayout.Layout[]) => {
    if (this._skipOnLayoutChange) {
      // Layout has been updated by other RTL handler already
      this._skipOnLayoutChange = false;
      return;
    }

    console.log('updating Layout', layout);

    for (const item of layout) {
      const child = this.getChild(item.i);

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

    this.setState({ children: sortChildrenByPosition(this.state.children) });
  };

  getChild(key: string) {
    for (const child of this.state.children) {
      if (child.state.key === key) {
        return child;
      }

      if (child instanceof SceneGridRow) {
        for (const rowChild of child.state.children) {
          if (rowChild.state.key === key) {
            return rowChild;
          }
        }
      }
    }

    throw new Error('Scene layout child not found for GridItem');
  }

  onResizeStop: ReactGridLayout.ItemCallback = (_, o, n) => {
    const child = this.getChild(n.i);

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

  /**
   *  We assume the layout array is storted according to y pos, and walk upwards until we find a row.
   *  If it is collapsed there is no row to add it to.
   */
  getRowAboveIndex(layout: ReactGridLayout.Layout[], startAt: number): SceneGridRow | null {
    if (startAt < 0) {
      return null;
    }

    for (let i = startAt; i >= 0; i--) {
      const gridItem = layout[i];
      const sceneChild = this.getChild(gridItem.i);

      if (sceneChild instanceof SceneGridRow) {
        // the closest row is collapsed return null
        if (sceneChild.state.isCollapsed) {
          return null;
        }

        return sceneChild;
      }
    }

    return null;
  }

  /**
   * This likely needs a slighltly different approach. Where we clone or deactivate or and re-activate the moved child
   */
  moveChildTo(child: SceneLayoutChild, target: SceneGridLayout | SceneGridRow) {
    const currentParent = child.parent!;

    if (currentParent instanceof SceneGridLayout || currentParent instanceof SceneGridRow) {
      currentParent.setState({
        children: currentParent.state.children.filter((c) => c.state.key !== child.state.key),
      });
    }

    const newChildren = [...target.state.children, child];

    target.setState({
      children: newChildren,
    });

    if (target !== this) {
      // to always force re-render
      this.setState({});
    }
  }

  onDragStop: ReactGridLayout.ItemCallback = (gridLayout, o, updatedItem) => {
    const sceneChild = this.getChild(updatedItem.i)!;

    // Need to resort the grid layout based on new position (needed to get the find the correct new parent row)
    gridLayout = sortGridLayout(gridLayout);

    // Update children positions if they have changed
    for (let i = 0; i < gridLayout.length; i++) {
      const gridItem = gridLayout[i];
      const child = this.getChild(gridItem.i)!;
      //const row = childDef.row;
      const childSize = child.state.size!;
      const childLayout = gridLayout[i];

      if (childSize?.x !== childLayout.x || childSize?.y !== childLayout.y) {
        child.setState({
          size: {
            ...child.state.size,
            x: childLayout.x,
            y: childLayout.y,
          },
        });
      }
    }

    // find closest row
    for (let index = 0; index < gridLayout.length; index++) {
      const gridItem = gridLayout[index];

      if (gridItem.i === updatedItem.i) {
        const rowAbove = this.getRowAboveIndex(gridLayout, index - 1);

        if (rowAbove && rowAbove !== sceneChild.parent) {
          this.moveChildTo(sceneChild, rowAbove);
        }
      }
    }

    this._skipOnLayoutChange = true;
  };

  toGridCell(child: SceneLayoutChild): ReactGridLayout.Layout {
    const size = child.state.size!;

    let x = 0;
    let y = 0;
    let w = 0;
    let h = 0;

    if (size.x !== undefined) {
      x = size.x;
    }

    if (size.y !== undefined) {
      y = size.y;
    }

    if (size.width !== undefined && typeof size.width === 'number') {
      w = size.width;
    }

    if (size.height !== undefined && typeof size.height === 'number') {
      h = size.height;
    }

    let isDraggable = Boolean(child.state.isDraggable);
    let isResizable = Boolean(child.state.isResizable);

    if (child instanceof SceneGridRow) {
      isDraggable = child.state.isCollapsed ? true : false;
      isResizable = false;
    }

    return { i: child.state.key!, x, y, h, w, isResizable, isDraggable };
  }

  buildGridLayout(width: number) {
    let cells: ReactGridLayout.Layout[] = [];

    for (const child of this.state.children) {
      cells.push(this.toGridCell(child));

      if (child instanceof SceneGridRow && !child.state.isCollapsed) {
        for (const rowChild of child.state.children) {
          cells.push(this.toGridCell(rowChild));
        }
      }
    }

    // Sort by position
    cells = sortGridLayout(cells);

    if (width < 768) {
      // We should not persist the mobile layout
      this._skipOnLayoutChange = true;
      return cells.map((cell) => ({ ...cell, w: 24 }));
    }

    this._skipOnLayoutChange = false;
    return cells;
  }
}

function SceneGridLayoutRenderer({ model }: SceneComponentProps<SceneGridLayout>) {
  const theme = useTheme2();
  const { children } = model.useState();
  validateChildrenSize(children);
  console.log('render grid');

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

        const layout = model.buildGridLayout(width);

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
              // @ts-ignore: ignoring for now until we make the size type numbers-only
              layout={layout}
              onDragStop={model.onDragStop}
              // onDrag={model.onDrag}
              onResizeStop={model.onResizeStop}
              onLayoutChange={model.onLayoutChange}
              isBounded={false}
              // compactType={null}
            >
              {layout.map((gridItem) => {
                const sceneChild = model.getChild(gridItem.i)!;
                return (
                  <div key={sceneChild.state.key} style={{ display: 'flex' }}>
                    <sceneChild.Component model={sceneChild} key={sceneChild.state.key} />
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

// function renderChildren(children: SceneLayoutChild[]) {
//   const elements: React.ReactNode[] = [];

//   for (const child of children) {
//     elements.push(
//       <div key={child.state.key} style={{ display: 'flex' }}>
//         <child.Component model={child} key={child.state.key} />
//       </div>
//     );

//     if (child instanceof SceneGridRow) {
//       if (child.state.isCollapsed) {
//         continue;
//       }

//       for (const rowChild of child.state.children) {
//         elements.push(
//           <div key={rowChild.state.key} style={{ display: 'flex' }}>
//             <rowChild.Component model={rowChild} key={rowChild.state.key} />
//           </div>
//         );
//       }
//     }
//   }

//   return elements;
// }

interface SceneGridRowState extends SceneLayoutChildState {
  title: string;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  children: Array<SceneObject<SceneLayoutChildState>>;
}

export class SceneGridRow extends SceneObjectBase<SceneGridRowState> {
  static Component = SceneGridRowRenderer;

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

    const { size } = this.state;
    if (!size) {
      return;
    }

    layout.toggleRow(this);
  };

  getHeight(): number {
    if (this.state.isCollapsed) {
      return 0;
    }

    let maxPos = this.state.size?.y! + 1;

    for (const child of this.state.children) {
      const yPos = child.state.size?.y! + child.state.size?.height!;
      if (yPos > maxPos) {
        maxPos = yPos;
      }
    }

    return maxPos - this.state.size?.y!;
  }
}

function SceneGridRowRenderer({ model }: SceneComponentProps<SceneGridRow>) {
  const styles = useStyles2(getSceneGridRowStyles);
  const { isCollapsible, isCollapsed, isDraggable, title } = model.useState();
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

function sortChildrenByPosition(children: SceneLayoutChild[]) {
  return [...children].sort((a, b) => {
    return a.state.size?.y! - b.state.size?.y! || a.state.size?.x! - b.state.size?.x!;
  });
}

function sortGridLayout(layout: ReactGridLayout.Layout[]) {
  return [...layout].sort((a, b) => a.y - b.y || a.x! - b.x);
}
