import * as tslib_1 from "tslib";
import React from 'react';
import classNames from 'classnames';
import templateSrv from 'app/features/templating/template_srv';
import appEvents from 'app/core/app_events';
var DashboardRow = /** @class */ (function (_super) {
    tslib_1.__extends(DashboardRow, _super);
    function DashboardRow(props) {
        var _this = _super.call(this, props) || this;
        _this.onVariableUpdated = function () {
            _this.forceUpdate();
        };
        _this.onToggle = function () {
            _this.props.dashboard.toggleRow(_this.props.panel);
            _this.setState(function (prevState) {
                return { collapsed: !prevState.collapsed };
            });
        };
        _this.onUpdate = function () {
            _this.props.dashboard.processRepeats();
            _this.forceUpdate();
        };
        _this.onOpenSettings = function () {
            appEvents.emit('show-modal', {
                templateHtml: "<row-options row=\"model.row\" on-updated=\"model.onUpdated()\" dismiss=\"dismiss()\"></row-options>",
                modalClass: 'modal--narrow',
                model: {
                    row: _this.props.panel,
                    onUpdated: _this.onUpdate,
                },
            });
        };
        _this.onDelete = function () {
            appEvents.emit('confirm-modal', {
                title: 'Delete Row',
                text: 'Are you sure you want to remove this row and all its panels?',
                altActionText: 'Delete row only',
                icon: 'fa-trash',
                onConfirm: function () {
                    _this.props.dashboard.removeRow(_this.props.panel, true);
                },
                onAltAction: function () {
                    _this.props.dashboard.removeRow(_this.props.panel, false);
                },
            });
        };
        _this.state = {
            collapsed: _this.props.panel.collapsed,
        };
        _this.props.dashboard.on('template-variable-value-updated', _this.onVariableUpdated);
        return _this;
    }
    DashboardRow.prototype.componentWillUnmount = function () {
        this.props.dashboard.off('template-variable-value-updated', this.onVariableUpdated);
    };
    DashboardRow.prototype.render = function () {
        var classes = classNames({
            'dashboard-row': true,
            'dashboard-row--collapsed': this.state.collapsed,
        });
        var chevronClass = classNames({
            fa: true,
            'fa-chevron-down': !this.state.collapsed,
            'fa-chevron-right': this.state.collapsed,
        });
        var title = templateSrv.replaceWithText(this.props.panel.title, this.props.panel.scopedVars);
        var count = this.props.panel.panels ? this.props.panel.panels.length : 0;
        var panels = count === 1 ? 'panel' : 'panels';
        var canEdit = this.props.dashboard.meta.canEdit === true;
        return (React.createElement("div", { className: classes },
            React.createElement("a", { className: "dashboard-row__title pointer", onClick: this.onToggle },
                React.createElement("i", { className: chevronClass }),
                title,
                React.createElement("span", { className: "dashboard-row__panel_count" },
                    "(",
                    count,
                    " ",
                    panels,
                    ")")),
            canEdit && (React.createElement("div", { className: "dashboard-row__actions" },
                React.createElement("a", { className: "pointer", onClick: this.onOpenSettings },
                    React.createElement("i", { className: "fa fa-cog" })),
                React.createElement("a", { className: "pointer", onClick: this.onDelete },
                    React.createElement("i", { className: "fa fa-trash" })))),
            this.state.collapsed === true && (React.createElement("div", { className: "dashboard-row__toggle-target", onClick: this.onToggle }, "\u00A0")),
            canEdit && React.createElement("div", { className: "dashboard-row__drag grid-drag-handle" })));
    };
    return DashboardRow;
}(React.Component));
export { DashboardRow };
//# sourceMappingURL=DashboardRow.js.map