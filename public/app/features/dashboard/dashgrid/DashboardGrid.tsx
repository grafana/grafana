// Libaries
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import ReactGridLayout, { ItemCallback } from 'react-grid-layout';
import classNames from 'classnames';
import sizeMe from 'react-sizeme';

// Types
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { DashboardPanel } from './DashboardPanel';
import { DashboardModel, PanelModel } from '../state';

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
  isFullscreen?: boolean;
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
  isFullscreen,
}: GridWrapperProps) {
  const width = size.width > 0 ? size.width : lastGridWidth;

  // logic to ignore width changes (optimization)
  if (width !== lastGridWidth) {
    if (ignoreNextWidthChange) {
      ignoreNextWidthChange = false;
    } else if (!isFullscreen && Math.abs(width - lastGridWidth) > 8) {
      onWidthChange();
      lastGridWidth = width;
    }
  }

  return (
    <ReactGridLayout
      width={lastGridWidth}
      className={className}
      isDraggable={isDraggable}
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
  isEditing: boolean;
  isFullscreen: boolean;
  scrollTop: number;
}

export class DashboardGrid extends PureComponent<Props> {
  panelMap: { [id: string]: PanelModel };
  panelRef: { [id: string]: HTMLElement } = {};

  componentDidMount() {
    const { dashboard } = this.props;
    dashboard.on('panel-added', this.triggerForceUpdate);
    dashboard.on('panel-removed', this.triggerForceUpdate);
    dashboard.on('repeats-processed', this.triggerForceUpdate);
    dashboard.on('view-mode-changed', this.onViewModeChanged);
    dashboard.on('row-collapsed', this.triggerForceUpdate);
    dashboard.on('row-expanded', this.triggerForceUpdate);
  }

  componentWillUnmount() {
    const { dashboard } = this.props;
    dashboard.off('panel-added', this.triggerForceUpdate);
    dashboard.off('panel-removed', this.triggerForceUpdate);
    dashboard.off('repeats-processed', this.triggerForceUpdate);
    dashboard.off('view-mode-changed', this.onViewModeChanged);
    dashboard.off('row-collapsed', this.triggerForceUpdate);
    dashboard.off('row-expanded', this.triggerForceUpdate);
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
      this.panelMap[newPos.i].updateGridPos(newPos);
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
    this.forceUpdate();
  };

  onViewModeChanged = () => {
    ignoreNextWidthChange = true;
  };

  updateGridPos = (item: ReactGridLayout.Layout, layout: ReactGridLayout.Layout[]) => {
    this.panelMap[item.i].updateGridPos(item);

    // react-grid-layout has a bug (#670), and onLayoutChange() is only called when the component is mounted.
    // So it's required to call it explicitly when panel resized or moved to save layout changes.
    this.onLayoutChange(layout);
  };

  onResize: ItemCallback = (layout, oldItem, newItem) => {
    this.panelMap[newItem.i].updateGridPos(newItem);
  };

  onResizeStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem, layout);
    this.panelMap[newItem.i].resizeDone();
  };

  onDragStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem, layout);
  };

  isInView = (panel: PanelModel): boolean => {
    if (panel.fullscreen || panel.isEditing) {
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
      const panelClasses = classNames({ 'react-grid-item--fullscreen': panel.fullscreen });
      const id = panel.id.toString();
      panel.isInView = this.isInView(panel);
      panelElements.push(
        <div
          key={id}
          className={panelClasses}
          id={'panel-' + id}
          ref={elem => {
            this.panelRef[id] = elem;
          }}
        >
          <DashboardPanel
            panel={panel}
            dashboard={this.props.dashboard}
            isEditing={panel.isEditing}
            isFullscreen={panel.fullscreen}
            isInView={panel.isInView}
          />
        </div>
      );
    }

    return panelElements;
  }

  render() {
    const { dashboard, isFullscreen } = this.props;

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
        isFullscreen={isFullscreen}
      >
        {this.renderPanels()}
      </SizedReactLayoutGrid>
    );
  }
}

export default hot(module)(DashboardGrid);
