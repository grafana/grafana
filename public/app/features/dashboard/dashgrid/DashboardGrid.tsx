// Libaries
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import ReactGridLayout, { ItemCallback } from 'react-grid-layout';
import classNames from 'classnames';
// @ts-ignore
import sizeMe from 'react-sizeme';
// Components
import { AddPanelWidget } from '../components/AddPanelWidget';
import { DashboardRow } from '../components/DashboardRow';
// Types
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { DashboardPanel } from './DashboardPanel';
import { DashboardModel, PanelModel } from '../state';
import { CoreEvents } from 'app/types';
import { panelAdded, panelRemoved } from '../state/PanelModel';

let lastGridWidth = 1200;
let ignoreNextWidthChange = false;

interface GridWrapperProps {
  size: { width: number };
  layout: ReactGridLayout.Layout[];
  onLayoutChange: (layout: ReactGridLayout.Layout[]) => void;
  children: JSX.Element | JSX.Element[];
  onDragStop: ItemCallback;
  onResize: ItemCallback;
  onResizeStop: ItemCallback;
  onWidthChange: () => void;
  className: string;
  isResizable?: boolean;
  isDraggable?: boolean;
  viewPanel: PanelModel | null;
}

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
  viewPanel,
}: GridWrapperProps) {
  const width = size.width > 0 ? size.width : lastGridWidth;

  // logic to ignore width changes (optimization)
  if (width !== lastGridWidth) {
    if (ignoreNextWidthChange) {
      ignoreNextWidthChange = false;
    } else if (!viewPanel && Math.abs(width - lastGridWidth) > 8) {
      onWidthChange();
      lastGridWidth = width;
    }
  }

  /*
    Disable draggable if mobile device, solving an issue with unintentionally
     moving panels. https://github.com/grafana/grafana/issues/18497
  */
  const draggable = width <= 420 ? false : isDraggable;
  return (
    <ReactGridLayout
      width={lastGridWidth}
      className={className}
      isDraggable={draggable}
      isResizable={isResizable}
      containerPadding={[0, 0]}
      useCSSTransforms={false}
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

export interface Props {
  dashboard: DashboardModel;
  editPanel: PanelModel | null;
  viewPanel: PanelModel | null;
  scrollTop: number;
  isPanelEditorOpen?: boolean;
}

export class DashboardGrid extends PureComponent<Props> {
  panelMap: { [id: string]: PanelModel };
  panelRef: { [id: string]: HTMLElement } = {};
  homeDashboard: boolean;

  componentDidMount() {
    const { dashboard } = this.props;
    this.homeDashboard = dashboard.uid === '7iOhKpdMH';
    dashboard.on(panelAdded, this.triggerForceUpdate);
    dashboard.on(panelRemoved, this.triggerForceUpdate);
    dashboard.on(CoreEvents.repeatsProcessed, this.triggerForceUpdate);
    dashboard.on(CoreEvents.rowCollapsed, this.triggerForceUpdate);
    dashboard.on(CoreEvents.rowExpanded, this.triggerForceUpdate);
  }

  componentWillUnmount() {
    const { dashboard } = this.props;
    dashboard.off(panelAdded, this.triggerForceUpdate);
    dashboard.off(panelRemoved, this.triggerForceUpdate);
    dashboard.off(CoreEvents.repeatsProcessed, this.triggerForceUpdate);
    dashboard.off(CoreEvents.rowCollapsed, this.triggerForceUpdate);
    dashboard.off(CoreEvents.rowExpanded, this.triggerForceUpdate);
  }

  buildLayout() {
    const layout = [];
    this.panelMap = {};

    for (const panel of this.props.dashboard.panels) {
      const stringId = panel.id.toString();
      this.panelMap[stringId] = panel;

      if (!panel.gridPos) {
        console.log('panel without gridpos');
        continue;
      }

      const panelPos: any = {
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

  onLayoutChange = (newLayout: ReactGridLayout.Layout[]) => {
    for (const newPos of newLayout) {
      this.panelMap[newPos.i!].updateGridPos(newPos);
    }

    this.props.dashboard.sortPanelsByGridPos();

    // Call render() after any changes.  This is called when the layour loads
    this.forceUpdate();
  };

  triggerForceUpdate = () => {
    this.forceUpdate();
  };

  onWidthChange = () => {
    for (const panel of this.props.dashboard.panels) {
      panel.resizeDone();
    }
  };

  updateGridPos = (item: ReactGridLayout.Layout, layout: ReactGridLayout.Layout[]) => {
    this.panelMap[item.i!].updateGridPos(item);

    // react-grid-layout has a bug (#670), and onLayoutChange() is only called when the component is mounted.
    // So it's required to call it explicitly when panel resized or moved to save layout changes.
    this.onLayoutChange(layout);
  };

  onResize: ItemCallback = (layout, oldItem, newItem) => {
    this.panelMap[newItem.i!].updateGridPos(newItem);
  };

  onResizeStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem, layout);
    this.panelMap[newItem.i!].resizeDone();
  };

  onDragStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem, layout);
  };

  isInView = (panel: PanelModel): boolean => {
    if (panel.isViewing || panel.isEditing) {
      return true;
    }

    // elem is set *after* the first render
    const elem = this.panelRef[panel.id.toString()];
    if (!elem) {
      // NOTE the gridPos is also not valid until after the first render
      // since it is passed to the layout engine and made to be valid
      // for example, you can have Y=0 for everything and it will stack them
      // down vertically in the second call
      return false;
    }

    const top = elem.offsetTop;
    const height = panel.gridPos.h * GRID_CELL_HEIGHT + 40;
    const bottom = top + height;

    // Show things that are almost in the view
    const buffer = 250;

    const viewTop = this.props.scrollTop;
    if (viewTop > bottom + buffer) {
      return false; // The panel is above the viewport
    }

    // Use the whole browser height (larger than real value)
    // TODO? is there a better way
    const viewHeight = isNaN(window.innerHeight) ? (window as any).clientHeight : window.innerHeight;
    const viewBot = viewTop + viewHeight;
    if (top > viewBot + buffer) {
      return false;
    }

    return !this.props.dashboard.otherPanelInFullscreen(panel);
  };

  renderPanels() {
    const panelElements = [];

    for (const panel of this.props.dashboard.panels) {
      const panelClasses = classNames({ 'react-grid-item--fullscreen': panel.isViewing });
      const id = panel.id.toString();
      panel.isInView = this.isInView(panel);

      panelElements.push(
        <div key={id} className={panelClasses} id={'panel-' + id} ref={elem => elem && (this.panelRef[id] = elem)}>
          {this.renderPanel(panel)}
        </div>
      );
    }

    return panelElements;
  }

  renderPanel(panel: PanelModel) {
    if (panel.type === 'row') {
      return <DashboardRow panel={panel} dashboard={this.props.dashboard} />;
    }

    if (panel.type === 'add-panel') {
      return <AddPanelWidget panel={panel} dashboard={this.props.dashboard} />;
    }

    return (
      <DashboardPanel
        panel={panel}
        dashboard={this.props.dashboard}
        isEditing={panel.isEditing}
        isViewing={panel.isViewing}
        isInView={panel.isInView}
      />
    );
  }

  render() {
    if (!this.homeDashboard) {
      return this.renderGrid();
    } else {
      return this.renderRowGrid();
    }
  }

  renderGrid() {
    const { dashboard, viewPanel } = this.props;

    return (
      <SizedReactLayoutGrid
        className={classNames({ layout: true })}
        layout={this.buildLayout()}
        isResizable={dashboard.meta.canEdit}
        isDraggable={dashboard.meta.canEdit}
        onLayoutChange={this.onLayoutChange}
        onWidthChange={this.onWidthChange}
        onDragStop={this.onDragStop}
        onResize={this.onResize}
        onResizeStop={this.onResizeStop}
        viewPanel={viewPanel}
      >
        {this.renderPanels()}
      </SizedReactLayoutGrid>
    );
  }

  renderRowGrid() {
    const { dashboard } = this.props;
    const panelsRepeat = dashboard.panels.filter(value => value.type !== 'row' && value.type !== 'dashlist');
    const panels: Array<{ scope: string; panels: PanelModel[] }> = this.groupPanelsByVar(panelsRepeat);
    return (
      <div className="home-panel-vis" style={{ paddingBottom: '20px' }}>
        <div className="row">
          {dashboard.panels
            .filter(value => value.type === 'dashlist')
            .map((panel, index) => {
              // panel.gridPos.h = 350;
              return (
                <div
                  className={this.setClassByPanelType(panel)}
                  id={'col' + index}
                  key={panel.id}
                  style={{ minHeight: '300px', padding: 0 }}
                >
                  <DashboardPanel
                    panel={panel}
                    dashboard={this.props.dashboard}
                    isEditing={false}
                    isViewing={true}
                    isInView={true}
                  />
                </div>
              );
            })}
        </div>
        <div className="row flew-wrap" style={{ margin: 0 }}>
          {panels.map((repeat, index) => {
            return (
              <div id={'col' + index} key={index} style={{ height: '100%', width: '250px', margin: '15px' }}>
                <a className="dashboard-row__title pointer">{repeat.scope}</a>
                <div className="row p-2 row-panel">
                  {repeat.panels.map((panel: PanelModel, indexPanel: number) => {
                    return (
                      <div
                        id={'col' + indexPanel}
                        key={panel.id}
                        style={{
                          height: indexPanel === 2 ? '180px' : '150px',
                          padding: '5px',
                          width: indexPanel === 2 ? '250px' : '125px',
                        }}
                      >
                        <DashboardPanel
                          panel={panel}
                          dashboard={this.props.dashboard}
                          isEditing={false}
                          isViewing={true}
                          isInView={true}
                          renderInHome={true}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  groupPanelsByVar(panels: PanelModel[]): Array<{ scope: string; panels: PanelModel[] }> {
    const scopeVars: Array<{ scope: string; panels: PanelModel[] }> = [];
    for (const panel of panels) {
      const repeat = panel.repeat ? panel.repeat : 'Server';
      if (repeat) {
        const indexScope = scopeVars.findIndex(value => value.scope === panel.scopedVars[repeat].value);
        if (indexScope === -1) {
          scopeVars.push({ scope: panel.scopedVars[repeat].value, panels: [panel] });
        } else {
          scopeVars[indexScope].panels.push(panel);
        }
      } else {
        scopeVars.push({ scope: 'Server', panels: [panel] });
      }
    }
    return scopeVars;
  }

  setClassByPanelType(panel: PanelModel) {
    if (panel.type === 'dashlist') {
      return 'col-lg-6 col-md-6 col-sm-12';
    } else {
      return 'col-lg-3 col-md-3 col-sm-12';
    }
  }

  setClassByPanelIndex(index: number) {
    if (index === 2) {
      return 'col-lg-12 col-md-12 col-sm-12';
    } else {
      return 'col-lg-6 col-md-6 col-sm-12';
    }
  }

  setHeightByPanelIndex(index: number) {
    if (index === 2) {
      return '180px';
    } else {
      return '150px';
    }
  }

  setPanelHeightByPanelIndex(index: number) {
    if (index === 2) {
      return '180px';
    } else {
      return '150px';
    }
  }
}

export default hot(module)(DashboardGrid);
