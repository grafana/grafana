import React, { ReactNode } from 'react';
import ReactGridLayout, { ItemCallback, Layout } from 'react-grid-layout';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneLayoutState, SceneComponentProps, SceneLayoutChild, SceneObjectSize } from '../core/types';

interface SceneGridLayoutState extends SceneLayoutState {}

export class SceneGridLayout extends SceneObjectBase<SceneGridLayoutState> {
  static Component = SceneGridLayoutRenderer;

  buildLayout(): Layout[] {
    const layout = [];

    for (const child of this.state.children) {
      if (!child.state.size) {
        console.log('panel without gridpos');
        continue;
      }

      layout.push(this.toGridPos(child.state.key!, child.state.size));
    }

    return layout;
  }

  toGridPos(key: string, size: SceneObjectSize): Layout {
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

    return { i: key, x, y, h, w };
  }

  gridPosToSize(layout: Layout): SceneObjectSize {
    return {
      x: layout.x,
      y: layout.y,
      width: layout.w,
      height: layout.h,
    };
  }

  updateGridPos(update: ReactGridLayout.Layout) {
    for (const child of this.state.children) {
      if (child.state.key === update.i) {
        child.setState({ size: this.gridPosToSize(update) });
      }
    }
  }

  onResize: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem);
  };

  onResizeStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem);
  };

  onDragStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem);
  };

  onLayoutChange = (newLayout: ReactGridLayout.Layout[]) => {
    for (const newPos of newLayout) {
      this.updateGridPos(newPos);
    }

    //this.props.dashboard.sortPanelsByGridPos();
  };
}

function SceneGridLayoutRenderer({ model }: SceneComponentProps<SceneGridLayout>) {
  const { children } = model.useState();
  const dashboard = { meta: { canEdit: true } };

  /**
   * We have a parent with "flex: 1 1 0" we need to reset it to "flex: 1 1 auto" to have the AutoSizer
   * properly working. For more information go here:
   * https://github.com/bvaughn/react-virtualized/blob/master/docs/usingAutoSizer.md#can-i-use-autosizer-within-a-flex-container
   */
  return (
    <div style={{ flex: '1 1 auto' }}>
      <AutoSizer disableHeight>
        {({ width }) => {
          if (width === 0) {
            return null;
          }

          const draggable = width <= 769 ? false : dashboard.meta.canEdit;

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
                isDraggable={draggable}
                isResizable={dashboard.meta.canEdit}
                containerPadding={[0, 0]}
                useCSSTransforms={false}
                margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
                cols={GRID_COLUMN_COUNT}
                rowHeight={GRID_CELL_HEIGHT}
                draggableHandle=".grid-drag-handle"
                layout={model.buildLayout()}
                onDragStop={model.onDragStop}
                onResize={model.onResize}
                onResizeStop={model.onResizeStop}
                onLayoutChange={model.onLayoutChange}
              >
                {renderPanels(children)}
              </ReactGridLayout>
            </div>
          );
        }}
      </AutoSizer>
    </div>
  );
}

function renderPanels(children: SceneLayoutChild[]): ReactNode {
  const panelElements = [];

  for (const panel of children) {
    panelElements.push(
      <div key={panel.state.key}>
        <panel.Component key={panel.state.key} model={panel} />
      </div>
    );
  }

  return panelElements;
}
