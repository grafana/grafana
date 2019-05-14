import * as tslib_1 from "tslib";
import React, { Component } from 'react';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import PanelHeaderCorner from './PanelHeaderCorner';
import { PanelHeaderMenu } from './PanelHeaderMenu';
import templateSrv from 'app/features/templating/template_srv';
import { ClickOutsideWrapper } from 'app/core/components/ClickOutsideWrapper/ClickOutsideWrapper';
var PanelHeader = /** @class */ (function (_super) {
    tslib_1.__extends(PanelHeader, _super);
    function PanelHeader() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.clickCoordinates = { x: 0, y: 0 };
        _this.state = {
            panelMenuOpen: false,
            clickCoordinates: { x: 0, y: 0 },
        };
        _this.eventToClickCoordinates = function (event) {
            return {
                x: event.clientX,
                y: event.clientY,
            };
        };
        _this.onMouseDown = function (event) {
            _this.clickCoordinates = _this.eventToClickCoordinates(event);
        };
        _this.isClick = function (clickCoordinates) {
            return isEqual(clickCoordinates, _this.clickCoordinates);
        };
        _this.onMenuToggle = function (event) {
            if (_this.isClick(_this.eventToClickCoordinates(event))) {
                event.stopPropagation();
                _this.setState(function (prevState) { return ({
                    panelMenuOpen: !prevState.panelMenuOpen,
                }); });
            }
        };
        _this.closeMenu = function () {
            _this.setState({
                panelMenuOpen: false,
            });
        };
        return _this;
    }
    PanelHeader.prototype.render = function () {
        var _a = this.props, panel = _a.panel, dashboard = _a.dashboard, timeInfo = _a.timeInfo, scopedVars = _a.scopedVars, error = _a.error, isFullscreen = _a.isFullscreen;
        var panelHeaderClass = classNames({ 'panel-header': true, 'grid-drag-handle': !isFullscreen });
        var title = templateSrv.replaceWithText(panel.title, scopedVars);
        return (React.createElement(React.Fragment, null,
            React.createElement(PanelHeaderCorner, { panel: panel, title: panel.title, description: panel.description, scopedVars: panel.scopedVars, links: panel.links, error: error }),
            React.createElement("div", { className: panelHeaderClass },
                React.createElement("div", { className: "panel-title-container", onClick: this.onMenuToggle, onMouseDown: this.onMouseDown },
                    React.createElement("div", { className: "panel-title" },
                        React.createElement("span", { className: "icon-gf panel-alert-icon" }),
                        React.createElement("span", { className: "panel-title-text" },
                            title,
                            " ",
                            React.createElement("span", { className: "fa fa-caret-down panel-menu-toggle" })),
                        this.state.panelMenuOpen && (React.createElement(ClickOutsideWrapper, { onClick: this.closeMenu },
                            React.createElement(PanelHeaderMenu, { panel: panel, dashboard: dashboard }))),
                        timeInfo && (React.createElement("span", { className: "panel-time-info" },
                            React.createElement("i", { className: "fa fa-clock-o" }),
                            " ",
                            timeInfo)))))));
    };
    return PanelHeader;
}(Component));
export { PanelHeader };
//# sourceMappingURL=PanelHeader.js.map