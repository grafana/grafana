import React, { useCallback, useMemo } from 'react';
import ReactGridLayout from 'react-grid-layout';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Icon } from '@grafana/ui';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
// import ReactGridLayout, { ItemCallback } from 'react-grid-layout';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutState } from '../core/types';

interface SceneGridLayoutState extends SceneLayoutState {
  children: SceneGridCell[];
}

// TODO: Separet children and size propertions into separate interfaces
interface SceneGridCellState extends SceneLayoutState {
  isResizable?: boolean;
  isDraggable?: boolean;
}

export class SceneGridLayout extends SceneObjectBase<SceneGridLayoutState> {
  static Component = SceneGridLayoutRenderer;

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
  };
}

function SceneGridLayoutRenderer({ model }: SceneComponentProps<SceneGridLayout>) {
  const { children } = model.useState();

  const layout = useMemo<ReactGridLayout.Layout[]>(() => {
    return children
      .map((child) => {
        const size = child.state.size;

        if (size) {
          return {
            i: child.state.key!,
            x: size.x,
            y: size.y,
            w: size.width,
            h: size.height,
            isResizable: Boolean(child.state.isResizable),
            isDraggable: Boolean(child.state.isDraggable),
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [children]);

  return (
    <AutoSizer disableHeight>
      {({ width }) => {
        if (width === 0) {
          return null;
        }

        // const draggable = width <= 769 ? false : dashboard.meta.canEdit;

        /*
            Disable draggable if mobile device, solving an issue with unintentionally
            moving panels. https://github.com/grafana/grafana/issues/18497
            theme.breakpoints.md = 769
          */

        return (
          /**
           * The children is using a width of 100% so we need to guarantee that it is wrapped
           * in an element that has the calculated size given by the AutoSizer. The AutoSizer
           * has a width of 0 and will let its content overflow its div.
           */
          <div style={{ width: `${width}px`, height: '100%' }}>
            <ReactGridLayout
              width={width}
              isDraggable={false}
              isResizable={false}
              containerPadding={[0, 0]}
              useCSSTransforms={false}
              margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
              cols={GRID_COLUMN_COUNT}
              rowHeight={GRID_CELL_HEIGHT}
              draggableHandle=".grid-drag-handle"
              layout={layout}
              onDragStop={model.onDragStop}
              onResizeStop={model.onResizeStop}
            >
              {children.map((child) => {
                return (
                  <div key={child.state.key}>
                    <child.Component model={child} key={child.state.key} />
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

export class SceneGridCell extends SceneObjectBase<SceneGridCellState> {
  static Component = SceneGridCellRenderer;
}

function SceneGridCellRenderer({ model }: SceneComponentProps<SceneGridCell>) {
  const { isDraggable } = model.useState();
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }}>
      {/* TODO: This is a temporary solution to make the grid cell draggable*/}
      {isDraggable && (
        <div
          className="grid-drag-handle"
          style={{
            width: '20px',
            height: '20px',
            position: 'absolute',
            top: '5px',
            right: '5px',
            zIndex: 1,
          }}
        >
          <Icon name="draggabledots" />
        </div>
      )}
      <>
        {model.state.children.map((child) => {
          return <child.Component key={child.state.key} model={child} />;
        })}
      </>
    </div>
  );
}
