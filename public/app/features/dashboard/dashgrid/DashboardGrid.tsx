import classNames from 'classnames';
import React, {CSSProperties, PureComponent} from 'react';
import ReactGridLayout, {ItemCallback} from 'react-grid-layout';
import {Subscription} from 'rxjs';

import {config} from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import {GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT} from 'app/core/constants';
import {contextSrv} from 'app/core/services/context_srv';
import {VariablesChanged} from 'app/features/variables/types';
import {DashboardPanelsChangedEvent} from 'app/types/events';

import {AddLibraryPanelWidget} from '../components/AddLibraryPanelWidget';
import {DashboardRow} from '../components/DashboardRow';
import {DashboardModel, PanelModel} from '../state';
import {GridPos} from '../state/PanelModel';

import DashboardEmpty from './DashboardEmpty';
import {DashboardPanel} from './DashboardPanel';
import {MergeRowsMenu} from "./MergeRowsMenu";

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
  draggingItem: any;
  mergingItem: any;
  preventCollision: boolean;
  isMenuOpen: boolean;
  canDragOnTop: boolean;
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
      draggingItem: null,
      mergingItem: null,
      preventCollision: false,
      isMenuOpen: false,
      canDragOnTop: false,
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

  onDragStart: ItemCallback = (layout, oldItem, newItem, placeholder, e) => {
    const panelValues = Object.values(this.panelMap);

    // The merge mechanism should only work if there are only row type panels in the grid
    const isThereInvalidPanels = panelValues.some((panel) => panel.type !== 'row' );
    this.setState({ draggingItem: newItem, mergingItem: null, preventCollision: !isThereInvalidPanels, canDragOnTop: !isThereInvalidPanels,});
  };

  onDrag: ItemCallback = (layout, oldItem, newItem, placeholder, e) => {
    const {canDragOnTop } = this.state;
    if (canDragOnTop) {
      const gridContainer = document.querySelector(".react-grid-layout");

      // Get mouse coordinates from the event object and adjust them relative to the grid container
      let mouseX: number;
      let mouseY: number;
      if (gridContainer !== null) {
        const gridRect = gridContainer.getBoundingClientRect();
        mouseX = e.clientX - gridRect.left;
        mouseY = e.clientY - gridRect.top;
      }
      else { // else made to avoid warnings
        mouseX = e.clientX;
        mouseY = e.clientY;
      }

      // Grid contains the coordinates of the dragged item in movement (scaled to the grid cell size)
      const grid: { x: number, y: number, w: number, h: number } = {
        x: mouseX / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN),
        y: mouseY / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN),
        w: newItem.w,
        h: newItem.h,
      };
      this.setState({mergingItem: null});

      const gapScaledToOne = GRID_CELL_VMARGIN / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN);
      const cellHeightScaledToOne = GRID_CELL_HEIGHT / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN);

      if (grid.y < newItem.y + cellHeightScaledToOne + gapScaledToOne &&
        grid.y > newItem.y - gapScaledToOne ) {
        this.setState({ preventCollision: true });
      } else {
        const belowItem: ReactGridLayout.Layout | null = this.findItemDirectlyBelow(layout, newItem);
        const aboveItem: ReactGridLayout.Layout | null = this.findItemDirectlyAbove(layout, newItem);
        let belowItemScreenCord: { x: number, y: number, w: number, h: number } | null = null;
        let aboveItemScreenCord: { x: number, y: number, w: number, h: number } | null = null;
        if (belowItem !== null) {
          belowItemScreenCord = {
            x: belowItem.x,
            y: belowItem.y - 0.25, // 0.25 = Small adjust
            w: belowItem.w,
            h: belowItem.h,
          };
        }
        if (aboveItem !== null) {
          aboveItemScreenCord = {
            x: aboveItem.x,
            y: aboveItem.y + 0.25, // 0.25 = Small adjust
            w: aboveItem.w,
            h: aboveItem.h,
          };
        }

        let overlapping = false;
        if (belowItem !== null && this.isOverlapping(grid, belowItemScreenCord)) {
          placeholder.x = belowItem.x;
          placeholder.y = belowItem.y;
          overlapping = true;
          this.setState({mergingItem: belowItem});
        } else if (aboveItem !== null && this.isOverlapping(grid, aboveItemScreenCord)) {
          placeholder.x = aboveItem.x;
          placeholder.y = aboveItem.y;
          overlapping = true;
          this.setState({mergingItem: aboveItem});
        } else {
          placeholder.x = newItem.x;
          placeholder.y = newItem.y;
        }
        this.setState({
          draggingItem: newItem,
          preventCollision: overlapping,
        });
      }
    } else {
      this.setState({draggingItem: newItem});
    }
  };

  onDragStop: ItemCallback = (layout, newItem) => {
    const {mergingItem, } = this.state;
    if (mergingItem) {
      this.setState({isMenuOpen: true});
    } else {
      this.setState({draggingItem: null, preventCollision: false});
    }
  };

  findItemDirectlyAbove = (layout: ReactGridLayout.Layout[], newItem: ReactGridLayout.Layout) => {
    const itemsAbove = layout.filter((item) => {
      return item.i !== newItem.i && newItem.y >= item.y;
    });

    let itemDirectlyAbove: ReactGridLayout.Layout | null = null;
    let maxY = -Infinity;

    for (let i = 0; i < itemsAbove.length; i++) {
      let item = itemsAbove[i];
      if (item.y > maxY) {
        maxY = item.y;
        itemDirectlyAbove = item;
      }
    }

    return itemDirectlyAbove;
  };

  findItemDirectlyBelow = (layout: ReactGridLayout.Layout[], newItem: ReactGridLayout.Layout) => {
    const itemsBelow = layout.filter((item) => {
      return item.i !== newItem.i && newItem.y <= item.y;
    });

    let itemDirectlyBelow: ReactGridLayout.Layout | null = null;
    let minY = Infinity;

    for (let i = 0; i < itemsBelow.length; i++) {
      let item = itemsBelow[i];
      if (item.y < minY) {
        minY = item.y;
        itemDirectlyBelow = item;
      }
    }

    return itemDirectlyBelow;
  };

  isOverlapping = (item1: { x: number, y: number, w: number, h: number } | null,
                   item2: { x: number, y: number, w: number, h: number } | null) => {
    if (!item1 || !item2) {
      return false;
    }
    const rect1 = {
      y1: item1.y,
    };
    const rect2 = {
      y1: item2.y,
      y2: item2.y + item2.h * GRID_CELL_HEIGHT / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN)
    };
    return (
      rect1.y1 >= rect2.y1 && rect1.y1 <= rect2.y2
    );
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
        <div style={{width: width, height: '100%'}} ref={this.onGetWrapperDivRef}>
          {this.state.isMenuOpen && (
            <MergeRowsMenu
              onClose={() => this.setState({isMenuOpen: false})}
              panelMap={this.panelMap}
              draggedItem={this.state.draggingItem}
              otherItem={this.state.mergingItem}
              isMenuOpen={this.state.isMenuOpen}
              dashboard={this.props.dashboard}
            />
          )}
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
            onDragStart={this.onDragStart}
            onDrag={this.onDrag}
            onDragStop={this.onDragStop}
            onResize={this.onResize}
            onResizeStop={this.onResizeStop}
            onLayoutChange={this.onLayoutChange}
            preventCollision={this.state.preventCollision}
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
