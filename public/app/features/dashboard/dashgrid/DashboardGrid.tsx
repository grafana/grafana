import React from 'react';
import coreModule from 'app/core/core_module';
import ReactGridLayout from 'react-grid-layout';
import {DashboardModel} from '../model';
import sizeMe from 'react-sizeme';

const COLUMN_COUNT = 24;
const ROW_HEIGHT = 30;

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
      margin={[10, 10]}
      cols={COLUMN_COUNT}
      rowHeight={ROW_HEIGHT}
      draggableHandle=".grid-drag-handle"
      layout={layout}
      onLayoutChange={onLayoutChange}>
      {children}
    </ReactGridLayout>
  );
}

const SizedReactLayoutGrid = sizeMe({monitorWidth: true})(GridWrapper);

export interface DashboardGridProps {
  dashboard: DashboardModel;
}

export class DashboardGrid extends React.Component<DashboardGridProps, any> {
  gridToPanelMap: any;

  constructor(props) {
    super(props);
    this.onLayoutChange = this.onLayoutChange.bind(this);
  }

  buildLayout() {
    const layout = [];
    for (let panel of this.props.dashboard.panels) {
      layout.push({
        i: panel.id.toString(),
        x: panel.x,
        y: panel.y,
        w: panel.width,
        h: panel.height,
      });
    }
    console.log(layout);
    return layout;
  }

  onLayoutChange() {}

  renderPanels() {
    const panelElements = [];
    for (let panel of this.props.dashboard.panels) {
      panelElements.push(
        <div key={panel.id.toString()} className="panel">
          <div className="panel-container">
            <div className="panel-header grid-drag-handle">
              <div className="panel-title-container">{panel.type}</div>
            </div>
            <div className="panel-content">
              {panel.title} - {panel.type}
            </div>
          </div>
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
  return reactDirective(DashboardGrid, [['dashboard', {watchDepth: 'reference'}]]);
});
