import React from 'react';
import coreModule from 'app/core/core_module';
import ReactGridLayout from 'react-grid-layout';
import {CELL_HEIGHT, CELL_VMARGIN} from '../DashboardModel';
import {DashboardPanel} from './DashboardPanel';
import {DashboardModel} from '../DashboardModel';
import {PanelContainer} from './PanelContainer';
import {PanelModel} from '../PanelModel';
import classNames from 'classnames';
import sizeMe from 'react-sizeme';

const COLUMN_COUNT = 12;

function GridWrapper({size, layout, onLayoutChange, children, onResize}) {
  if (size.width === 0) {
    console.log('size is zero!');
  }

  const gridWidth = size.width > 0 ? size.width : 1200;

  return (
    <ReactGridLayout
      width={gridWidth}
      className="layout"
      isDraggable={true}
      isResizable={true}
      measureBeforeMount={false}
      containerPadding={[0, 0]}
      useCSSTransforms={true}
      margin={[CELL_VMARGIN, CELL_VMARGIN]}
      cols={COLUMN_COUNT}
      rowHeight={CELL_HEIGHT}
      draggableHandle=".grid-drag-handle"
      layout={layout}
      onResize={onResize}
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

    // subscribe to dashboard events
    this.dashboard = this.panelContainer.getDashboard();
    this.dashboard.on('panel-added', this.panelAdded.bind(this));
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

  panelAdded() {
    this.forceUpdate();
  }

  onResize(layout, oldItem, newItem) {
    this.panelMap[newItem.i].updateGridPos(newItem);
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
    console.log('DashboardGrid.render()');
    return (
      <SizedReactLayoutGrid layout={this.buildLayout()} onLayoutChange={this.onLayoutChange} onResize={this.onResize}>
        {this.renderPanels()}
      </SizedReactLayoutGrid>
    );
  }
}

coreModule.directive('dashboardGrid', function(reactDirective) {
  return reactDirective(DashboardGrid, [['getPanelContainer', {watchDepth: 'reference', wrapApply: false}]]);
});
