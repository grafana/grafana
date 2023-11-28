import { __rest } from "tslib";
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import ReactGridLayout from 'react-grid-layout';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Subscription } from 'rxjs';
import { config } from '@grafana/runtime';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardPanelsChangedEvent } from 'app/types/events';
import { AddLibraryPanelWidget } from '../components/AddLibraryPanelWidget';
import { AddPanelWidget } from '../components/AddPanelWidget';
import { DashboardRow } from '../components/DashboardRow';
import DashboardEmpty from './DashboardEmpty';
import { DashboardPanel } from './DashboardPanel';
export class DashboardGrid extends PureComponent {
    constructor(props) {
        super(props);
        this.panelMap = {};
        this.eventSubs = new Subscription();
        this.windowHeight = 1200;
        this.windowWidth = 1920;
        this.gridWidth = 0;
        /** Used to keep track of mobile panel layout position */
        this.lastPanelBottom = 0;
        this.isLayoutInitialized = false;
        this.onLayoutChange = (newLayout) => {
            for (const newPos of newLayout) {
                this.panelMap[newPos.i].updateGridPos(newPos, this.isLayoutInitialized);
            }
            if (this.isLayoutInitialized) {
                this.isLayoutInitialized = true;
            }
            this.props.dashboard.sortPanelsByGridPos();
            this.forceUpdate();
        };
        this.triggerForceUpdate = () => {
            this.forceUpdate();
        };
        this.updateGridPos = (item, layout) => {
            this.panelMap[item.i].updateGridPos(item);
        };
        this.onResize = (layout, oldItem, newItem) => {
            const panel = this.panelMap[newItem.i];
            panel.updateGridPos(newItem);
        };
        this.onResizeStop = (layout, oldItem, newItem) => {
            this.updateGridPos(newItem, layout);
        };
        this.onDragStop = (layout, oldItem, newItem) => {
            this.updateGridPos(newItem, layout);
        };
        /**
         * Without this hack the move animations are triggered on initial load and all panels fly into position.
         * This can be quite distracting and make the dashboard appear to less snappy.
         */
        this.onGetWrapperDivRef = (ref) => {
            if (ref && contextSrv.user.authenticatedBy !== 'render') {
                setTimeout(() => {
                    ref.classList.add('react-grid-layout--enable-move-animations');
                }, 50);
            }
        };
    }
    componentDidMount() {
        const { dashboard } = this.props;
        this.eventSubs.add(dashboard.events.subscribe(DashboardPanelsChangedEvent, this.triggerForceUpdate));
    }
    componentWillUnmount() {
        this.eventSubs.unsubscribe();
    }
    buildLayout() {
        const layout = [];
        this.panelMap = {};
        for (const panel of this.props.dashboard.panels) {
            if (!panel.key) {
                panel.key = `panel-${panel.id}-${Date.now()}`;
            }
            this.panelMap[panel.key] = panel;
            if (!panel.gridPos) {
                console.log('panel without gridpos');
                continue;
            }
            const panelPos = {
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
            layout.push(panelPos);
        }
        return layout;
    }
    getPanelScreenPos(panel, gridWidth) {
        let top = 0;
        // mobile layout
        if (gridWidth < config.theme2.breakpoints.values.md) {
            // In mobile layout panels are stacked so we just add the panel vertical margin to the last panel bottom position
            top = this.lastPanelBottom + GRID_CELL_VMARGIN;
        }
        else {
            // For top position we need to add back the vertical margin removed by translateGridHeightToScreenHeight
            top = translateGridHeightToScreenHeight(panel.gridPos.y) + GRID_CELL_VMARGIN;
        }
        this.lastPanelBottom = top + translateGridHeightToScreenHeight(panel.gridPos.h);
        return { top, bottom: this.lastPanelBottom };
    }
    renderPanels(gridWidth, isDashboardDraggable) {
        var _a;
        const panelElements = [];
        // Reset last panel bottom
        this.lastPanelBottom = 0;
        // This is to avoid layout re-flows, accessing window.innerHeight can trigger re-flow
        // We assume here that if width change height might have changed as well
        if (this.gridWidth !== gridWidth) {
            this.windowHeight = (_a = window.innerHeight) !== null && _a !== void 0 ? _a : 1000;
            this.windowWidth = window.innerWidth;
            this.gridWidth = gridWidth;
        }
        for (const panel of this.props.dashboard.panels) {
            const panelClasses = classNames({ 'react-grid-item--fullscreen': panel.isViewing });
            // used to allow overflowing content to show on top of the next panel
            const descIndex = this.props.dashboard.panels.length - panelElements.length;
            panelElements.push(React.createElement(GrafanaGridItem, { key: panel.key, className: panelClasses, descendingOrderIndex: descIndex, "data-panelid": panel.id, gridPos: panel.gridPos, gridWidth: gridWidth, windowHeight: this.windowHeight, windowWidth: this.windowWidth, isViewing: panel.isViewing }, (width, height) => {
                return this.renderPanel(panel, width, height, isDashboardDraggable);
            }));
        }
        return panelElements;
    }
    renderPanel(panel, width, height, isDraggable) {
        if (panel.type === 'row') {
            return React.createElement(DashboardRow, { key: panel.key, panel: panel, dashboard: this.props.dashboard });
        }
        // Todo: Remove this when we remove the emptyDashboardPage toggle
        if (panel.type === 'add-panel') {
            return React.createElement(AddPanelWidget, { key: panel.key, panel: panel, dashboard: this.props.dashboard });
        }
        if (panel.type === 'add-library-panel') {
            return React.createElement(AddLibraryPanelWidget, { key: panel.key, panel: panel, dashboard: this.props.dashboard });
        }
        return (React.createElement(DashboardPanel, { key: panel.key, stateKey: panel.key, panel: panel, dashboard: this.props.dashboard, isEditing: panel.isEditing, isViewing: panel.isViewing, isDraggable: isDraggable, width: width, height: height, hideMenu: this.props.hidePanelMenus }));
    }
    render() {
        const { isEditable, dashboard } = this.props;
        if (config.featureToggles.emptyDashboardPage && dashboard.panels.length === 0) {
            return React.createElement(DashboardEmpty, { dashboard: dashboard, canCreate: isEditable });
        }
        /**
         * We have a parent with "flex: 1 1 0" we need to reset it to "flex: 1 1 auto" to have the AutoSizer
         * properly working. For more information go here:
         * https://github.com/bvaughn/react-virtualized/blob/master/docs/usingAutoSizer.md#can-i-use-autosizer-within-a-flex-container
         */
        return (React.createElement("div", { style: { flex: '1 1 auto', display: this.props.editPanel ? 'none' : undefined } },
            React.createElement(AutoSizer, { disableHeight: true }, ({ width }) => {
                if (width === 0) {
                    return null;
                }
                // Disable draggable if mobile device, solving an issue with unintentionally
                // moving panels. https://github.com/grafana/grafana/issues/18497
                const draggable = width <= config.theme2.breakpoints.values.md ? false : isEditable;
                return (
                /**
                 * The children is using a width of 100% so we need to guarantee that it is wrapped
                 * in an element that has the calculated size given by the AutoSizer. The AutoSizer
                 * has a width of 0 and will let its content overflow its div.
                 */
                React.createElement("div", { style: { width: width, height: '100%' }, ref: this.onGetWrapperDivRef },
                    React.createElement(ReactGridLayout, { width: width, isDraggable: draggable, isResizable: isEditable, containerPadding: [0, 0], useCSSTransforms: true, margin: [GRID_CELL_VMARGIN, GRID_CELL_VMARGIN], cols: GRID_COLUMN_COUNT, rowHeight: GRID_CELL_HEIGHT, draggableHandle: ".grid-drag-handle", draggableCancel: ".grid-drag-cancel", layout: this.buildLayout(), onDragStop: this.onDragStop, onResize: this.onResize, onResizeStop: this.onResizeStop, onLayoutChange: this.onLayoutChange }, this.renderPanels(width, draggable))));
            })));
    }
}
/**
 * A hacky way to intercept the react-layout-grid item dimensions and pass them to DashboardPanel
 */
const GrafanaGridItem = React.forwardRef((props, ref) => {
    var _a;
    const theme = config.theme2;
    let width = 100;
    let height = 100;
    const { gridWidth, gridPos, isViewing, windowHeight, windowWidth, descendingOrderIndex } = props, divProps = __rest(props, ["gridWidth", "gridPos", "isViewing", "windowHeight", "windowWidth", "descendingOrderIndex"]);
    const style = (_a = props.style) !== null && _a !== void 0 ? _a : {};
    if (isViewing) {
        // In fullscreen view mode a single panel take up full width & 85% height
        width = gridWidth;
        height = windowHeight * 0.85;
        style.height = height;
        style.width = '100%';
    }
    else if (windowWidth < theme.breakpoints.values.md) {
        // Mobile layout is a bit different, every panel take up full width
        width = props.gridWidth;
        height = translateGridHeightToScreenHeight(gridPos.h);
        style.height = height;
        style.width = '100%';
    }
    else {
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
    return (React.createElement("div", Object.assign({}, divProps, { style: Object.assign(Object.assign({}, divProps.style), { zIndex: descendingOrderIndex }), ref: ref }), [props.children[0](width, height), props.children.slice(1)]));
});
/**
 * This translates grid height dimensions to real pixels
 */
function translateGridHeightToScreenHeight(gridHeight) {
    return gridHeight * (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN) - GRID_CELL_VMARGIN;
}
GrafanaGridItem.displayName = 'GridItemWithDimensions';
//# sourceMappingURL=DashboardGrid.js.map