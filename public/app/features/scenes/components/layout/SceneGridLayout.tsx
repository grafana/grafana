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
    });
  }

  toggleRow(row: SceneGridRow, isCollapsed: boolean) {
    // Should we make sure position is correct for all children?
    if (!isCollapsed) {
      for (const child of row.state.children) {
        child.setState({
          size: {
            ...child.state.size,
            y: Math.max(row.state.size!.y! + 1, child.state.size!.y!),
          },
        });
      }
    }

    row.setState({ isCollapsed });
    // Trigger re-render
    this.setState({});
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
  };

  getChild(key: string) {
    return this.state.children.find((child) => {
      if (child.state.key === key) {
        return true;
      }

      if (child instanceof SceneGridLayout) {
        return child.state.children.find((rowChild) => rowChild.state.key === key);
      }

      return false;
    });
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

  getRowAboveIndex(layout: ReactGridLayout.Layout[], startAt: number) {
    for (let i = startAt; i < layout.length; i++) {
      const gridItem = layout[i];
      const sceneChild = this.getChild(gridItem.i);

      if (sceneChild instanceof SceneGridRow) {
        // the closest row is collapsed return undefined
        if (sceneChild.state.isCollapsed) {
          return undefined;
        }

        return sceneChild;
      }
    }

    return undefined;
  }

  moveChildToRow(child: SceneLayoutChild, target: SceneGridLayout | SceneGridRow) {
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

    // to always force re-render
    this.setState({});
  }

  onDragStop: ReactGridLayout.ItemCallback = (gridLayout, o, updatedItem) => {
    const sceneChild = this.getChild(updatedItem.i)!;

    // find closest row
    for (let index = 0; index < gridLayout.length; index++) {
      const gridItem = gridLayout[index];

      if (gridItem.i === updatedItem.i) {
        const rowAbove = this.getRowAboveIndex(gridLayout, index - 1);

        if (rowAbove && rowAbove !== sceneChild.parent) {
          this.moveChildToRow(sceneChild, rowAbove);
        }
      }
    }

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

  buildGridLayout() {
    let cells: ReactGridLayout.Layout[] = [];

    for (const child of this.state.children) {
      cells.push(this.toGridCell(child));

      if (child instanceof SceneGridRow && !child.state.isCollapsed) {
        for (const rowChild of child.state.children) {
          cells.push(this.toGridCell(rowChild));
        }
      }
    }

    cells.sort((panelA, panelB) => {
      if (panelA.y === panelB.y) {
        return panelA.x - panelB.x;
      } else {
        return panelA.y - panelB.y;
      }
    });

    return { lg: cells, sm: cells.map((l) => ({ ...l, w: 24 })) };
  }
}

function SceneGridLayoutRenderer({ model }: SceneComponentProps<SceneGridLayout>) {
  const theme = useTheme2();
  const { children } = model.useState();
  validateChildrenSize(children);

  const layout = model.buildGridLayout();

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
              {renderChildren(model.state.children)}
            </ReactGridLayout>
          </div>
        );
      }}
    </AutoSizer>
  );
}

function renderChildren(children: SceneLayoutChild[]) {
  const elements: React.ReactNode[] = [];

  for (const child of children) {
    elements.push(
      <div key={child.state.key} style={{ display: 'flex' }}>
        <child.Component model={child} key={child.state.key} />
      </div>
    );

    if (child instanceof SceneGridRow) {
      if (child.state.isCollapsed) {
        continue;
      }

      for (const rowChild of child.state.children) {
        elements.push(
          <div key={rowChild.state.key} style={{ display: 'flex' }}>
            <rowChild.Component model={rowChild} key={rowChild.state.key} />
          </div>
        );
      }
    }
  }

  return elements;
}

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

    const { isCollapsed, size } = this.state;
    if (!size) {
      return;
    }

    layout.toggleRow(this, !isCollapsed);
  };
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
