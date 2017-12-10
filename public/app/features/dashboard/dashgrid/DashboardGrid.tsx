import React from 'react';
import coreModule from 'app/core/core_module';
import ReactGridLayout from 'react-grid-layout';
import {GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT} from 'app/core/constants';
import {DashboardPanel} from './DashboardPanel';
import {DashboardModel} from '../dashboard_model';
import {PanelContainer} from './PanelContainer';
import {PanelModel} from '../panel_model';
import classNames from 'classnames';
import sizeMe from 'react-sizeme';

let lastGridWidth = 1200;

export interface GridWrapperProps {
  size: any;
  layout: any;
  children: any;
  onResize: any;
  onResizeStop: any;
  onWidthChange: any;
  onLayoutChange: any;
}

class GridWrapper extends React.Component<GridWrapperProps, any> {
  animated: boolean;

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    // Disable animation on initial rendering and enable it when component has been mounted.
    this.animated = true;
  }

  render() {
    if (this.props.size.width === 0) {
      console.log('size is zero!');
    }

    const width = this.props.size.width > 0 ? this.props.size.width : lastGridWidth;
    if (width !== lastGridWidth) {
      this.props.onWidthChange();
      lastGridWidth = width;
    }

    return (
      <ReactGridLayout
        width={lastGridWidth}
        className={this.animated ? 'layout animated' : 'layout'}
        isDraggable={true}
        isResizable={true}
        measureBeforeMount={false}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
        margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
        cols={GRID_COLUMN_COUNT}
        rowHeight={GRID_CELL_HEIGHT}
        draggableHandle=".grid-drag-handle"
        layout={this.props.layout}
        onResize={this.props.onResize}
        onResizeStop={this.props.onResizeStop}
        onLayoutChange={this.props.onLayoutChange}>
        {this.props.children}
      </ReactGridLayout>
    );
  }
}

const SizedReactLayoutGrid = sizeMe({monitorWidth: true})(GridWrapper);

export interface DashboardGridProps {
  getPanelContainer: () => PanelContainer;
}

export class DashboardGrid extends React.Component<DashboardGridProps, any> {
  gridToPanelMap: any;
  panelContainer: PanelContainer;
  dashboard: DashboardModel;
  panelMap: {[id: string]: PanelModel};

  constructor(props) {
    super(props);
    this.panelContainer = this.props.getPanelContainer();
    this.onLayoutChange = this.onLayoutChange.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onResizeStop = this.onResizeStop.bind(this);
    this.onWidthChange = this.onWidthChange.bind(this);

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

  onResize(layout, oldItem, newItem) {
    this.panelMap[newItem.i].updateGridPos(newItem);
  }

  onResizeStop(layout, oldItem, newItem) {
    this.panelMap[newItem.i].resizeDone();
  }

  renderPanels() {
    const panelElements = [];

    for (let panel of this.dashboard.panels) {
      const panelClasses = classNames({panel: true, 'panel--fullscreen': panel.fullscreen});
      panelElements.push(
        <div key={panel.id.toString()} className={panelClasses}>
          <DashboardPanel panel={panel} getPanelContainer={this.props.getPanelContainer} />
        </div>,
      );
    }

    return panelElements;
  }

  render() {
    return (
      <SizedReactLayoutGrid
        layout={this.buildLayout()}
        onLayoutChange={this.onLayoutChange}
        onWidthChange={this.onWidthChange}
        onResize={this.onResize}
        onResizeStop={this.onResizeStop}>
        {this.renderPanels()}
      </SizedReactLayoutGrid>
    );
  }
}

coreModule.directive('dashboardGrid', function(reactDirective) {
  return reactDirective(DashboardGrid, [['getPanelContainer', {watchDepth: 'reference', wrapApply: false}]]);
});
