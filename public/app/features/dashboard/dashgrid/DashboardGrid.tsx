import React from 'react';
import coreModule from 'app/core/core_module';
import ReactGridLayout from 'react-grid-layout';
import {CELL_HEIGHT, CELL_VMARGIN} from '../model';
import {DashboardPanel} from './DashboardPanel';
import {PanelContainer} from './PanelContainer';
import {PanelModel} from '../PanelModel';
import sizeMe from 'react-sizeme';

const COLUMN_COUNT = 12;

function GridWrapper({size, layout, onLayoutChange, children}) {
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
  panelMap: {[id: string]: PanelModel};

  constructor(props) {
    super(props);
    this.panelContainer = this.props.getPanelContainer();
    this.onLayoutChange = this.onLayoutChange.bind(this);
  }

  buildLayout() {
    const layout = [];
    const panels = this.panelContainer.getPanels();
    this.panelMap = {};

    for (let panel of panels) {
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

  renderPanels() {
    const panels = this.panelContainer.getPanels();
    const panelElements = [];

    for (let panel of panels) {
      panelElements.push(
        <div key={panel.id.toString()} className="panel">
          <DashboardPanel panel={panel} getPanelContainer={this.props.getPanelContainer} />
        </div>,
      );
    }

    return panelElements;
  }

  render() {
    return (
      <SizedReactLayoutGrid layout={this.buildLayout()} onLayoutChange={this.onLayoutChange}>
        {this.renderPanels()}
      </SizedReactLayoutGrid>
    );
  }
}

coreModule.directive('dashboardGrid', function(reactDirective) {
  return reactDirective(DashboardGrid, [['getPanelContainer', {watchDepth: 'reference', wrapApply: false}]]);
});
