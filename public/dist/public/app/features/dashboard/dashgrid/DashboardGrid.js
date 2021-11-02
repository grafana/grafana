import { __assign, __extends, __rest, __values } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import ReactGridLayout from 'react-grid-layout';
import classNames from 'classnames';
import AutoSizer from 'react-virtualized-auto-sizer';
// Components
import { AddPanelWidget } from '../components/AddPanelWidget';
import { DashboardRow } from '../components/DashboardRow';
// Types
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { DashboardPanel } from './DashboardPanel';
import { Subscription } from 'rxjs';
import { DashboardPanelsChangedEvent } from 'app/types/events';
import { config } from '@grafana/runtime';
var DashboardGrid = /** @class */ (function (_super) {
    __extends(DashboardGrid, _super);
    function DashboardGrid(props) {
        var _this = _super.call(this, props) || this;
        _this.panelMap = {};
        _this.eventSubs = new Subscription();
        _this.windowHeight = 1200;
        _this.windowWidth = 1920;
        _this.gridWidth = 0;
        /** Used to keep track of mobile panel layout position */
        _this.lastPanelBottom = 0;
        _this.onLayoutChange = function (newLayout) {
            var e_1, _a;
            try {
                for (var newLayout_1 = __values(newLayout), newLayout_1_1 = newLayout_1.next(); !newLayout_1_1.done; newLayout_1_1 = newLayout_1.next()) {
                    var newPos = newLayout_1_1.value;
                    _this.panelMap[newPos.i].updateGridPos(newPos);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (newLayout_1_1 && !newLayout_1_1.done && (_a = newLayout_1.return)) _a.call(newLayout_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            _this.props.dashboard.sortPanelsByGridPos();
            // This is called on grid mount as it can correct invalid initial grid positions
            if (!_this.state.isLayoutInitialized) {
                _this.setState({ isLayoutInitialized: true });
            }
        };
        _this.triggerForceUpdate = function () {
            _this.forceUpdate();
        };
        _this.updateGridPos = function (item, layout) {
            _this.panelMap[item.i].updateGridPos(item);
        };
        _this.onResize = function (layout, oldItem, newItem) {
            var panel = _this.panelMap[newItem.i];
            panel.updateGridPos(newItem);
            panel.configRev++; // trigger change handler
        };
        _this.onResizeStop = function (layout, oldItem, newItem) {
            _this.updateGridPos(newItem, layout);
        };
        _this.onDragStop = function (layout, oldItem, newItem) {
            _this.updateGridPos(newItem, layout);
        };
        _this.state = {
            isLayoutInitialized: false,
        };
        return _this;
    }
    DashboardGrid.prototype.componentDidMount = function () {
        var dashboard = this.props.dashboard;
        this.eventSubs.add(dashboard.events.subscribe(DashboardPanelsChangedEvent, this.triggerForceUpdate));
    };
    DashboardGrid.prototype.componentWillUnmount = function () {
        this.eventSubs.unsubscribe();
    };
    DashboardGrid.prototype.buildLayout = function () {
        var e_2, _a;
        var layout = [];
        this.panelMap = {};
        try {
            for (var _b = __values(this.props.dashboard.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                if (!panel.key) {
                    panel.key = "panel-" + panel.id + "-" + Date.now();
                }
                this.panelMap[panel.key] = panel;
                if (!panel.gridPos) {
                    console.log('panel without gridpos');
                    continue;
                }
                var panelPos = {
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
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return layout;
    };
    DashboardGrid.prototype.isInView = function (panel, gridWidth) {
        if (panel.isViewing || panel.isEditing) {
            return true;
        }
        var scrollTop = this.props.scrollTop;
        var screenPos = this.getPanelScreenPos(panel, gridWidth);
        // Show things that are almost in the view
        var buffer = 100;
        // The panel is above the viewport
        if (scrollTop > screenPos.bottom + buffer) {
            return false;
        }
        var scrollViewBottom = scrollTop + this.windowHeight;
        // Panel is below view
        if (screenPos.top > scrollViewBottom + buffer) {
            return false;
        }
        return !this.props.dashboard.otherPanelInFullscreen(panel);
    };
    DashboardGrid.prototype.getPanelScreenPos = function (panel, gridWidth) {
        var top = 0;
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
        return { top: top, bottom: this.lastPanelBottom };
    };
    DashboardGrid.prototype.renderPanels = function (gridWidth) {
        var e_3, _a;
        var _this = this;
        var _b;
        var panelElements = [];
        // Reset last panel bottom
        this.lastPanelBottom = 0;
        // This is to avoid layout re-flows, accessing window.innerHeight can trigger re-flow
        // We assume here that if width change height might have changed as well
        if (this.gridWidth !== gridWidth) {
            this.windowHeight = (_b = window.innerHeight) !== null && _b !== void 0 ? _b : 1000;
            this.windowWidth = window.innerWidth;
            this.gridWidth = gridWidth;
        }
        var _loop_1 = function (panel) {
            var panelClasses = classNames({ 'react-grid-item--fullscreen': panel.isViewing });
            // Update is in view state
            panel.isInView = this_1.isInView(panel, gridWidth);
            panelElements.push(React.createElement(GrafanaGridItem, { key: panel.key, className: panelClasses, "data-panelid": panel.id, gridPos: panel.gridPos, gridWidth: gridWidth, windowHeight: this_1.windowHeight, windowWidth: this_1.windowWidth, isViewing: panel.isViewing }, function (width, height) {
                return _this.renderPanel(panel, width, height);
            }));
        };
        var this_1 = this;
        try {
            for (var _c = __values(this.props.dashboard.panels), _d = _c.next(); !_d.done; _d = _c.next()) {
                var panel = _d.value;
                _loop_1(panel);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return panelElements;
    };
    DashboardGrid.prototype.renderPanel = function (panel, width, height) {
        if (panel.type === 'row') {
            return React.createElement(DashboardRow, { key: panel.key, panel: panel, dashboard: this.props.dashboard });
        }
        if (panel.type === 'add-panel') {
            return React.createElement(AddPanelWidget, { key: panel.key, panel: panel, dashboard: this.props.dashboard });
        }
        return (React.createElement(DashboardPanel, { key: panel.key, stateKey: panel.key, panel: panel, dashboard: this.props.dashboard, isEditing: panel.isEditing, isViewing: panel.isViewing, isInView: panel.isInView, width: width, height: height }));
    };
    DashboardGrid.prototype.render = function () {
        var _this = this;
        var dashboard = this.props.dashboard;
        return (
        /**
         * We have a parent with "flex: 1 1 0" we need to reset it to "flex: 1 1 auto" to have the AutoSizer
         * properly working. For more information go here:
         * https://github.com/bvaughn/react-virtualized/blob/master/docs/usingAutoSizer.md#can-i-use-autosizer-within-a-flex-container
         */
        React.createElement("div", { style: { flex: '1 1 auto' } },
            React.createElement(AutoSizer, { disableHeight: true }, function (_a) {
                var width = _a.width;
                if (width === 0) {
                    return null;
                }
                var draggable = width <= 769 ? false : dashboard.meta.canEdit;
                /*
                Disable draggable if mobile device, solving an issue with unintentionally
                moving panels. https://github.com/grafana/grafana/issues/18497
                theme.breakpoints.md = 769
              */
                return (
                /**
                 * The children is using a width of 100% so we need to guarantee that it is wrapped
                 * in an element that has the calculated size given by the AutoSizer. The AutoSizer
                 * has a width of 0 and will let its content overflow its div.
                 */
                React.createElement("div", { style: { width: width + "px", height: '100%' } },
                    React.createElement(ReactGridLayout, { width: width, isDraggable: draggable, isResizable: dashboard.meta.canEdit, containerPadding: [0, 0], useCSSTransforms: false, margin: [GRID_CELL_VMARGIN, GRID_CELL_VMARGIN], cols: GRID_COLUMN_COUNT, rowHeight: GRID_CELL_HEIGHT, draggableHandle: ".grid-drag-handle", layout: _this.buildLayout(), onDragStop: _this.onDragStop, onResize: _this.onResize, onResizeStop: _this.onResizeStop, onLayoutChange: _this.onLayoutChange }, _this.renderPanels(width))));
            })));
    };
    return DashboardGrid;
}(PureComponent));
export { DashboardGrid };
/**
 * A hacky way to intercept the react-layout-grid item dimensions and pass them to DashboardPanel
 */
var GrafanaGridItem = React.forwardRef(function (props, ref) {
    var _a;
    var theme = config.theme2;
    var width = 100;
    var height = 100;
    var gridWidth = props.gridWidth, gridPos = props.gridPos, isViewing = props.isViewing, windowHeight = props.windowHeight, windowWidth = props.windowWidth, divProps = __rest(props, ["gridWidth", "gridPos", "isViewing", "windowHeight", "windowWidth"]);
    var style = (_a = props.style) !== null && _a !== void 0 ? _a : {};
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
        width = parseFloat(props.style.width);
        height = parseFloat(props.style.height);
    }
    // props.children[0] is our main children. RGL adds the drag handle at props.children[1]
    return (React.createElement("div", __assign({}, divProps, { ref: ref }), [props.children[0](width, height), props.children.slice(1)]));
});
/**
 * This translates grid height dimensions to real pixels
 */
function translateGridHeightToScreenHeight(gridHeight) {
    return gridHeight * (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN) - GRID_CELL_VMARGIN;
}
GrafanaGridItem.displayName = 'GridItemWithDimensions';
//# sourceMappingURL=DashboardGrid.js.map