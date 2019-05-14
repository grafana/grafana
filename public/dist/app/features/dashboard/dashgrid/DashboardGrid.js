import * as tslib_1 from "tslib";
// Libaries
import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import ReactGridLayout from 'react-grid-layout';
import classNames from 'classnames';
import sizeMe from 'react-sizeme';
// Types
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { DashboardPanel } from './DashboardPanel';
var lastGridWidth = 1200;
var ignoreNextWidthChange = false;
function GridWrapper(_a) {
    var size = _a.size, layout = _a.layout, onLayoutChange = _a.onLayoutChange, children = _a.children, onDragStop = _a.onDragStop, onResize = _a.onResize, onResizeStop = _a.onResizeStop, onWidthChange = _a.onWidthChange, className = _a.className, isResizable = _a.isResizable, isDraggable = _a.isDraggable, isFullscreen = _a.isFullscreen;
    var width = size.width > 0 ? size.width : lastGridWidth;
    // logic to ignore width changes (optimization)
    if (width !== lastGridWidth) {
        if (ignoreNextWidthChange) {
            ignoreNextWidthChange = false;
        }
        else if (!isFullscreen && Math.abs(width - lastGridWidth) > 8) {
            onWidthChange();
            lastGridWidth = width;
        }
    }
    return (React.createElement(ReactGridLayout, { width: lastGridWidth, className: className, isDraggable: isDraggable, isResizable: isResizable, containerPadding: [0, 0], useCSSTransforms: false, margin: [GRID_CELL_VMARGIN, GRID_CELL_VMARGIN], cols: GRID_COLUMN_COUNT, rowHeight: GRID_CELL_HEIGHT, draggableHandle: ".grid-drag-handle", layout: layout, onResize: onResize, onResizeStop: onResizeStop, onDragStop: onDragStop, onLayoutChange: onLayoutChange }, children));
}
var SizedReactLayoutGrid = sizeMe({ monitorWidth: true })(GridWrapper);
var DashboardGrid = /** @class */ (function (_super) {
    tslib_1.__extends(DashboardGrid, _super);
    function DashboardGrid() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onLayoutChange = function (newLayout) {
            var e_1, _a;
            try {
                for (var newLayout_1 = tslib_1.__values(newLayout), newLayout_1_1 = newLayout_1.next(); !newLayout_1_1.done; newLayout_1_1 = newLayout_1.next()) {
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
        };
        _this.triggerForceUpdate = function () {
            _this.forceUpdate();
        };
        _this.onWidthChange = function () {
            var e_2, _a;
            try {
                for (var _b = tslib_1.__values(_this.props.dashboard.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var panel = _c.value;
                    panel.resizeDone();
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
        };
        _this.onViewModeChanged = function () {
            ignoreNextWidthChange = true;
        };
        _this.updateGridPos = function (item, layout) {
            _this.panelMap[item.i].updateGridPos(item);
            // react-grid-layout has a bug (#670), and onLayoutChange() is only called when the component is mounted.
            // So it's required to call it explicitly when panel resized or moved to save layout changes.
            _this.onLayoutChange(layout);
        };
        _this.onResize = function (layout, oldItem, newItem) {
            console.log();
            _this.panelMap[newItem.i].updateGridPos(newItem);
        };
        _this.onResizeStop = function (layout, oldItem, newItem) {
            _this.updateGridPos(newItem, layout);
            _this.panelMap[newItem.i].resizeDone();
        };
        _this.onDragStop = function (layout, oldItem, newItem) {
            _this.updateGridPos(newItem, layout);
        };
        return _this;
    }
    DashboardGrid.prototype.componentDidMount = function () {
        var dashboard = this.props.dashboard;
        dashboard.on('panel-added', this.triggerForceUpdate);
        dashboard.on('panel-removed', this.triggerForceUpdate);
        dashboard.on('repeats-processed', this.triggerForceUpdate);
        dashboard.on('view-mode-changed', this.onViewModeChanged);
        dashboard.on('row-collapsed', this.triggerForceUpdate);
        dashboard.on('row-expanded', this.triggerForceUpdate);
    };
    DashboardGrid.prototype.componentWillUnmount = function () {
        var dashboard = this.props.dashboard;
        dashboard.off('panel-added', this.triggerForceUpdate);
        dashboard.off('panel-removed', this.triggerForceUpdate);
        dashboard.off('repeats-processed', this.triggerForceUpdate);
        dashboard.off('view-mode-changed', this.onViewModeChanged);
        dashboard.off('row-collapsed', this.triggerForceUpdate);
        dashboard.off('row-expanded', this.triggerForceUpdate);
    };
    DashboardGrid.prototype.buildLayout = function () {
        var e_3, _a;
        var layout = [];
        this.panelMap = {};
        try {
            for (var _b = tslib_1.__values(this.props.dashboard.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                var stringId = panel.id.toString();
                this.panelMap[stringId] = panel;
                if (!panel.gridPos) {
                    console.log('panel without gridpos');
                    continue;
                }
                var panelPos = {
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
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return layout;
    };
    DashboardGrid.prototype.renderPanels = function () {
        var e_4, _a;
        var panelElements = [];
        try {
            for (var _b = tslib_1.__values(this.props.dashboard.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                var panelClasses = classNames({ 'react-grid-item--fullscreen': panel.fullscreen });
                panelElements.push(React.createElement("div", { key: panel.id.toString(), className: panelClasses, id: "panel-" + panel.id },
                    React.createElement(DashboardPanel, { panel: panel, dashboard: this.props.dashboard, isEditing: panel.isEditing, isFullscreen: panel.fullscreen })));
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return panelElements;
    };
    DashboardGrid.prototype.render = function () {
        var _a = this.props, dashboard = _a.dashboard, isFullscreen = _a.isFullscreen;
        return (React.createElement(SizedReactLayoutGrid, { className: classNames({ layout: true }), layout: this.buildLayout(), isResizable: dashboard.meta.canEdit, isDraggable: dashboard.meta.canEdit, onLayoutChange: this.onLayoutChange, onWidthChange: this.onWidthChange, onDragStop: this.onDragStop, onResize: this.onResize, onResizeStop: this.onResizeStop, isFullscreen: isFullscreen }, this.renderPanels()));
    };
    return DashboardGrid;
}(PureComponent));
export { DashboardGrid };
export default hot(module)(DashboardGrid);
//# sourceMappingURL=DashboardGrid.js.map