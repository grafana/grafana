import React from 'react';
import coreModule from 'app/core/core_module';
import ReactGridLayout from 'react-grid-layout';
import {CELL_HEIGHT, CELL_VMARGIN} from '../dashboard_model';
import {DashboardPanel} from './DashboardPanel';
import {DashboardModel} from '../dashboard_model';
import {PanelContainer} from './PanelContainer';
import {PanelModel} from '../panel_model';
import classNames from 'classnames';
import sizeMe from 'react-sizeme';

const COLUMN_COUNT = 12;
let lastGridWidth = 1200;

function GridWrapper({size, layout, onLayoutChange, children, onResize, onResizeStop, onWidthChange}) {
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
      className="layout"
      isDraggable={true}
      isResizable={true}
      measureBeforeMount={false}
      containerPadding={[0, 0]}
      useCSSTransforms={false}
      margin={[CELL_VMARGIN, CELL_VMARGIN]}
      cols={COLUMN_COUNT}
      rowHeight={CELL_HEIGHT}
      draggableHandle=".grid-drag-handle"
      layout={layout}
      onResize={onResize}
      onResizeStop={onResizeStop}
      onLayoutChange={onLayoutChange}>
      {children}
    </ReactGridLayout>
  );
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
    this.dashboard.on('view-mode-changed', this.triggerForceUpdate.bind(this));
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

      layout.push({
        i: stringId,
        x: panel.gridPos.x,
        y: panel.gridPos.y,
        w: panel.gridPos.w,
        h: panel.gridPos.h,
      });
    }

    return layout;
  }

  onLayoutChange(newLayout) {
    for (const newPos of newLayout) {
      this.panelMap[newPos.i].updateGridPos(newPos);
    }
  }

  triggerForceUpdate() {
    this.forceUpdate();
  }

  onWidthChange() {
    console.log('width change');
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
