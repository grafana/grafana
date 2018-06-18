import React from 'react';
import ReactGridLayout from 'react-grid-layout';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { DashboardPanel } from './DashboardPanel';
import { DashboardModel } from '../dashboard_model';
import { PanelContainer } from './PanelContainer';
import { PanelModel } from '../panel_model';
import classNames from 'classnames';
import sizeMe from 'react-sizeme';

let lastGridWidth = 1200;

function GridWrapper({
  size,
  layout,
  onLayoutChange,
  children,
  onDragStop,
  onResize,
  onResizeStop,
  onWidthChange,
  className,
  isResizable,
  isDraggable,
}) {
  if (size.width === 0) {
    console.log('size is zero!');
  }

  const width = size.width > 0 ? size.width : lastGridWidth;
  if (width !== lastGridWidth) {
    onWidthChange();
    lastGridWidth = width;
  }

  return (
    <ReactGridLayout
      width={lastGridWidth}
      className={className}
      isDraggable={isDraggable}
      isResizable={isResizable}
      measureBeforeMount={false}
      containerPadding={[0, 0]}
      useCSSTransforms={true}
      margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
      cols={GRID_COLUMN_COUNT}
      rowHeight={GRID_CELL_HEIGHT}
      draggableHandle=".grid-drag-handle"
      layout={layout}
      onResize={onResize}
      onResizeStop={onResizeStop}
      onDragStop={onDragStop}
      onLayoutChange={onLayoutChange}
    >
      {children}
    </ReactGridLayout>
  );
}

const SizedReactLayoutGrid = sizeMe({ monitorWidth: true })(GridWrapper);

export interface DashboardGridProps {
  getPanelContainer: () => PanelContainer;
}

export class DashboardGrid extends React.Component<DashboardGridProps, any> {
  gridToPanelMap: any;
  panelContainer: PanelContainer;
  dashboard: DashboardModel;
  panelMap: { [id: string]: PanelModel };

  constructor(props) {
    super(props);
    this.panelContainer = this.props.getPanelContainer();
    this.onLayoutChange = this.onLayoutChange.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onResizeStop = this.onResizeStop.bind(this);
    this.onDragStop = this.onDragStop.bind(this);
    this.onWidthChange = this.onWidthChange.bind(this);

    this.state = { animated: false };

    // subscribe to dashboard events
    this.dashboard = this.panelContainer.getDashboard();
    this.dashboard.on('panel-added', this.triggerForceUpdate.bind(this));
    this.dashboard.on('panel-removed', this.triggerForceUpdate.bind(this));
    this.dashboard.on('repeats-processed', this.triggerForceUpdate.bind(this));
    this.dashboard.on('view-mode-changed', this.triggerForceUpdate.bind(this));
    this.dashboard.on('row-collapsed', this.triggerForceUpdate.bind(this));
    this.dashboard.on('row-expanded', this.triggerForceUpdate.bind(this));
  }

  buildLayout() {
    const layout = [];
    this.panelMap = {};

    for (let panel of this.dashboard.panels) {
      let stringId = panel.id.toString();
      this.panelMap[stringId] = panel;

      if (!panel.gridPos) {
        console.log('panel without gridpos');
        continue;
      }

      let panelPos: any = {
        i: stringId,
        x: panel.gridPos.x,
        y: panel.gridPos.y,
        w: panel.gridPos.w,
        h: panel.gridPos.h,
      };

      if (panel.type === 'row') {
        panelPos.w = GRID_COLUMN_COUNT;
        panelPos.h = 1;
        panelPos.isResizable = false;
        panelPos.isDraggable = panel.collapsed;
      }

      layout.push(panelPos);
    }

    return layout;
  }

  onLayoutChange(newLayout) {
    for (const newPos of newLayout) {
      this.panelMap[newPos.i].updateGridPos(newPos);
    }

    this.dashboard.sortPanelsByGridPos();
  }

  triggerForceUpdate() {
    this.forceUpdate();
  }

  onWidthChange() {
    for (const panel of this.dashboard.panels) {
      panel.resizeDone();
    }
  }

  updateGridPos(item, layout) {
    this.panelMap[item.i].updateGridPos(item);

    // react-grid-layout has a bug (#670), and onLayoutChange() is only called when the component is mounted.
    // So it's required to call it explicitly when panel resized or moved to save layout changes.
    this.onLayoutChange(layout);
  }

  onResize(layout, oldItem, newItem) {
    this.panelMap[newItem.i].updateGridPos(newItem);
  }

  onResizeStop(layout, oldItem, newItem) {
    this.updateGridPos(newItem, layout);
    this.panelMap[newItem.i].resizeDone();
  }

  onDragStop(layout, oldItem, newItem) {
    this.updateGridPos(newItem, layout);
  }

  componentDidMount() {
    setTimeout(() => {
      this.setState(() => {
        return { animated: true };
      });
    });
  }

  renderPanels() {
    const panelElements = [];

    for (let panel of this.dashboard.panels) {
      const panelClasses = classNames({ panel: true, 'panel--fullscreen': panel.fullscreen });
      panelElements.push(
        <div key={panel.id.toString()} className={panelClasses}>
          <DashboardPanel panel={panel} getPanelContainer={this.props.getPanelContainer} />
        </div>
      );
    }

    return panelElements;
  }

  render() {
    return (
      <SizedReactLayoutGrid
        className={classNames({ layout: true, animated: this.state.animated })}
        layout={this.buildLayout()}
        isResizable={this.dashboard.meta.canEdit}
        isDraggable={this.dashboard.meta.canEdit}
        onLayoutChange={this.onLayoutChange}
        onWidthChange={this.onWidthChange}
        onDragStop={this.onDragStop}
        onResize={this.onResize}
        onResizeStop={this.onResizeStop}
      >
        {this.renderPanels()}
      </SizedReactLayoutGrid>
    );
  }
}
