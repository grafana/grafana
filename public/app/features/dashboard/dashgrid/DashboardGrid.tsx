import classNames from 'classnames';
import { PureComponent, CSSProperties } from 'react';
import * as React from 'react';
import ReactGridLayout, { ItemCallback } from 'react-grid-layout';
import { Subscription } from 'rxjs';

import { config } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { VariablesChanged } from 'app/features/variables/types';
import { DashboardPanelsChangedEvent } from 'app/types/events';

import { AddLibraryPanelWidget } from '../components/AddLibraryPanelWidget';
import { DashboardRow } from '../components/DashboardRow';
import { DashboardModel, PanelModel } from '../state';
import { GridPos } from '../state/PanelModel';

import DashboardEmpty from './DashboardEmpty';
import { DashboardPanel } from './DashboardPanel';

export const PANEL_FILTER_VARIABLE = 'systemPanelFilterVar';

export interface Props {
  dashboard: DashboardModel;
  isEditable: boolean;
  editPanel: PanelModel | null;
  viewPanel: PanelModel | null;
  hidePanelMenus?: boolean;
}

interface State {
  panelFilter?: RegExp;
  width: number;
}

export class DashboardGrid extends PureComponent<Props, State> {
  private panelMap: { [key: string]: PanelModel } = {};
  private eventSubs = new Subscription();
  private windowHeight = 1200;
  private windowWidth = 1920;
  private gridWidth = 0;
  /** Used to keep track of mobile panel layout position */
  private lastPanelBottom = 0;
  private isLayoutInitialized = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      panelFilter: undefined,
      width: document.body.clientWidth, // initial very rough estimate
    };
  }

  componentDidMount() {
    const { dashboard } = this.props;

    if (config.featureToggles.panelFilterVariable) {
      // If panel filter variable is set on load then
      // update state to filter panels
      for (const variable of dashboard.getVariables()) {
        if (variable.id === PANEL_FILTER_VARIABLE) {
          if ('query' in variable) {
            this.setPanelFilter(variable.query);
          }
          break;
        }
      }

      this.eventSubs.add(
        appEvents.subscribe(VariablesChanged, (e) => {
          if (e.payload.variable?.id === PANEL_FILTER_VARIABLE) {
            if ('current' in e.payload.variable) {
              let variable = e.payload.variable.current;
              if ('value' in variable && typeof variable.value === 'string') {
                this.setPanelFilter(variable.value);
              }
            }
          }
        })
      );
    }

    this.eventSubs.add(dashboard.events.subscribe(DashboardPanelsChangedEvent, this.triggerForceUpdate));
  }

  componentWillUnmount() {
    this.eventSubs.unsubscribe();
  }

  setPanelFilter(regex: string) {
    // Only set the panels filter if the systemPanelFilterVar variable
    // is a non-empty string
    let panelFilter = undefined;
    if (regex.length > 0) {
      panelFilter = new RegExp(regex, 'i');
    }

    this.setState({
      panelFilter: panelFilter,
    });
  }

  buildLayout() {
    const layout: ReactGridLayout.Layout[] = [];
    this.panelMap = {};
    const { panelFilter } = this.state;

    let count = 0;
    for (const panel of this.props.dashboard.panels) {
      if (!panel.key) {
        panel.key = `panel-${panel.id}-${Date.now()}`;
      }
      panel.title = panel.title?.substring(0, 5000);
      this.panelMap[panel.key] = panel;

      if (!panel.gridPos) {
        console.log('panel without gridpos');
        continue;
      }

      const panelPos: ReactGridLayout.Layout = {
        i: panel.key,
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

      if (!panelFilter) {
        layout.push(panelPos);
      } else {
        if (panelFilter.test(panel.title)) {
          panelPos.isResizable = false;
          panelPos.isDraggable = false;
          panelPos.x = (count % 2) * GRID_COLUMN_COUNT;
          panelPos.y = Math.floor(count / 2);
          layout.push(panelPos);
          count++;
        }
      }
    }

    return layout;
  }

  onLayoutChange = (newLayout: ReactGridLayout.Layout[]) => {
    if (this.state.panelFilter) {
      return;
    }
    for (const newPos of newLayout) {
      this.panelMap[newPos.i!].updateGridPos(newPos, this.isLayoutInitialized);
    }

    if (this.isLayoutInitialized) {
      this.isLayoutInitialized = true;
    }

    this.props.dashboard.sortPanelsByGridPos();
    this.forceUpdate();
  };

  triggerForceUpdate = () => {
    this.forceUpdate();
  };

  updateGridPos = (item: ReactGridLayout.Layout, layout: ReactGridLayout.Layout[]) => {
    this.panelMap[item.i!].updateGridPos(item);
  };

  onResize: ItemCallback = (layout, oldItem, newItem) => {
    const panel = this.panelMap[newItem.i!];
    panel.updateGridPos(newItem);
  };

  onResizeStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem, layout);
  };

  onDragStop: ItemCallback = (layout, oldItem, newItem) => {
    this.updateGridPos(newItem, layout);
  };

  getPanelScreenPos(panel: PanelModel, gridWidth: number): { top: number; bottom: number } {
    let top = 0;

    // mobile layout
    if (gridWidth < config.theme2.breakpoints.values.md) {
      // In mobile layout panels are stacked so we just add the panel vertical margin to the last panel bottom position
      top = this.lastPanelBottom + GRID_CELL_VMARGIN;
    } else {
      // For top position we need to add back the vertical margin removed by translateGridHeightToScreenHeight
      top = translateGridHeightToScreenHeight(panel.gridPos.y) + GRID_CELL_VMARGIN;
    }

    this.lastPanelBottom = top + translateGridHeightToScreenHeight(panel.gridPos.h);

    return { top, bottom: this.lastPanelBottom };
  }

  renderPanels(gridWidth: number, isDashboardDraggable: boolean) {
    const { panelFilter } = this.state;
    const panelElements = [];

    // Reset last panel bottom
    this.lastPanelBottom = 0;

    // This is to avoid layout re-flows, accessing window.innerHeight can trigger re-flow
    // We assume here that if width change height might have changed as well
    if (this.gridWidth !== gridWidth) {
      this.windowHeight = window.innerHeight ?? 1000;
      this.windowWidth = window.innerWidth;
      this.gridWidth = gridWidth;
    }

    for (const panel of this.props.dashboard.panels) {
      const panelClasses = classNames({ 'react-grid-item--fullscreen': panel.isViewing });

      const p = (
        <GrafanaGridItem
          key={panel.key}
          className={panelClasses}
          data-panelid={panel.id}
          gridPos={panel.gridPos}
          gridWidth={gridWidth}
          windowHeight={this.windowHeight}
          windowWidth={this.windowWidth}
          isViewing={panel.isViewing}
        >
          {(width: number, height: number) => {
            return this.renderPanel(panel, width, height, isDashboardDraggable);
          }}
        </GrafanaGridItem>
      );

      if (!panelFilter) {
        panelElements.push(p);
      } else {
        if (panelFilter.test(panel.title)) {
          panelElements.push(p);
        }
      }
    }

    return panelElements;
  }

  renderPanel(panel: PanelModel, width: number, height: number, isDraggable: boolean) {
    if (panel.type === 'row') {
      return <DashboardRow key={panel.key} panel={panel} dashboard={this.props.dashboard} />;
    }

    if (panel.type === 'add-library-panel') {
      return <AddLibraryPanelWidget key={panel.key} panel={panel} dashboard={this.props.dashboard} />;
    }

    return (
      <DashboardPanel
        key={panel.key}
        stateKey={panel.key}
        panel={panel}
        dashboard={this.props.dashboard}
        isEditing={panel.isEditing}
        isViewing={panel.isViewing}
        isDraggable={isDraggable}
        width={width}
        height={height}
        hideMenu={this.props.hidePanelMenus}
      />
    );
  }

  /**
   * Without this hack the move animations are triggered on initial load and all panels fly into position.
   * This can be quite distracting and make the dashboard appear to less snappy.
   */
  onGetWrapperDivRef = (ref: HTMLDivElement | null) => {
    if (ref && contextSrv.user.authenticatedBy !== 'render') {
      setTimeout(() => {
        ref.classList.add('react-grid-layout--enable-move-animations');
      }, 50);
    }
  };

  private resizeObserver?: ResizeObserver;
  private rootEl: HTMLDivElement | null = null;
  onMeasureRef = (rootEl: HTMLDivElement | null) => {
    if (!rootEl) {
      if (this.rootEl && this.resizeObserver) {
        this.resizeObserver.unobserve(this.rootEl);
      }
      return;
    }

    this.rootEl = rootEl;
    this.resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        this.setState({ width: entry.contentRect.width });
      });
    });

    this.resizeObserver.observe(rootEl);
  };

  render() {
    const { isEditable, dashboard } = this.props;
    const { width } = this.state;

    if (dashboard.panels.length === 0) {
      return <DashboardEmpty dashboard={dashboard} canCreate={isEditable} />;
    }

    const draggable = width <= config.theme2.breakpoints.values.md ? false : isEditable;

    // pos: rel + z-index is required to create a new stacking context to contain
    // the escalating z-indexes of the panels
    return (
      <div
        ref={this.onMeasureRef}
        style={{
          flex: '1 1 auto',
          position: 'relative',
          zIndex: 1,
          display: this.props.editPanel ? 'none' : undefined,
        }}
      >
        <div style={{ width: width, height: '100%' }} ref={this.onGetWrapperDivRef}>
          <ReactGridLayout
            width={width}
            isDraggable={draggable}
            isResizable={isEditable}
            containerPadding={[0, 0]}
            useCSSTransforms={true}
            margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
            cols={GRID_COLUMN_COUNT}
            rowHeight={GRID_CELL_HEIGHT}
            draggableHandle=".grid-drag-handle"
            draggableCancel=".grid-drag-cancel"
            layout={this.buildLayout()}
            onDragStop={this.onDragStop}
            onResize={this.onResize}
            onResizeStop={this.onResizeStop}
            onLayoutChange={this.onLayoutChange}
          >
            {this.renderPanels(width, draggable)}
          </ReactGridLayout>
        </div>
      </div>
    );
  }
}

interface GrafanaGridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  gridWidth?: number;
  gridPos?: GridPos;
  isViewing: boolean;
  windowHeight: number;
  windowWidth: number;
  children: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * A hacky way to intercept the react-layout-grid item dimensions and pass them to DashboardPanel
 */
const GrafanaGridItem = React.forwardRef<HTMLDivElement, GrafanaGridItemProps>((props, ref) => {
  const theme = config.theme2;
  let width = 100;
  let height = 100;

  const { gridWidth, gridPos, isViewing, windowHeight, windowWidth, ...divProps } = props;
  const style: CSSProperties = props.style ?? {};

  if (isViewing) {
    // In fullscreen view mode a single panel take up full width & 85% height
    width = gridWidth!;
    height = windowHeight * 0.85;
    style.height = height;
    style.width = '100%';
  } else if (windowWidth < theme.breakpoints.values.md) {
    // Mobile layout is a bit different, every panel take up full width
    width = props.gridWidth!;
    height = translateGridHeightToScreenHeight(gridPos!.h);
    style.height = height;
    style.width = '100%';
  } else {
    // Normal grid layout. The grid framework passes width and height directly to children as style props.
    if (props.style) {
      const { width: styleWidth, height: styleHeight } = props.style;
      if (styleWidth != null) {
        width = typeof styleWidth === 'number' ? styleWidth : parseFloat(styleWidth);
      }
      if (styleHeight != null) {
        height = typeof styleHeight === 'number' ? styleHeight : parseFloat(styleHeight);
      }
    }
  }

  // props.children[0] is our main children. RGL adds the drag handle at props.children[1]
  return (
    <div {...divProps} style={{ ...divProps.style }} ref={ref}>
      {/* Pass width and height to children as render props */}
      {[props.children[0](width, height), props.children.slice(1)]}
    </div>
  );
});

/**
 * This translates grid height dimensions to real pixels
 */
function translateGridHeightToScreenHeight(gridHeight: number): number {
  return gridHeight * (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN) - GRID_CELL_VMARGIN;
}

GrafanaGridItem.displayName = 'GridItemWithDimensions';
