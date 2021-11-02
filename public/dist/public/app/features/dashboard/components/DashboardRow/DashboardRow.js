import { __extends } from "tslib";
import React from 'react';
import classNames from 'classnames';
import { Icon } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { RowOptionsButton } from '../RowOptions/RowOptionsButton';
import { getTemplateSrv, RefreshEvent } from '@grafana/runtime';
import { ShowConfirmModalEvent } from '../../../../types/events';
var DashboardRow = /** @class */ (function (_super) {
    __extends(DashboardRow, _super);
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
        _this.onUpdate = function (title, repeat) {
            _this.props.panel['title'] = title;
            _this.props.panel['repeat'] = repeat !== null && repeat !== void 0 ? repeat : undefined;
            _this.props.panel.render();
            _this.props.dashboard.processRepeats();
            _this.forceUpdate();
        };
        _this.onDelete = function () {
            appEvents.publish(new ShowConfirmModalEvent({
                title: 'Delete row',
                text: 'Are you sure you want to remove this row and all its panels?',
                altActionText: 'Delete row only',
                icon: 'trash-alt',
                onConfirm: function () {
                    _this.props.dashboard.removeRow(_this.props.panel, true);
                },
                onAltAction: function () {
                    _this.props.dashboard.removeRow(_this.props.panel, false);
                },
            }));
        };
        _this.state = {
            collapsed: _this.props.panel.collapsed,
        };
        return _this;
    }
    DashboardRow.prototype.componentDidMount = function () {
        this.sub = this.props.dashboard.events.subscribe(RefreshEvent, this.onVariableUpdated);
    };
    DashboardRow.prototype.componentWillUnmount = function () {
        if (this.sub) {
            this.sub.unsubscribe();
        }
    };
    DashboardRow.prototype.render = function () {
        var classes = classNames({
            'dashboard-row': true,
            'dashboard-row--collapsed': this.state.collapsed,
        });
        var title = getTemplateSrv().replace(this.props.panel.title, this.props.panel.scopedVars, 'text');
        var count = this.props.panel.panels ? this.props.panel.panels.length : 0;
        var panels = count === 1 ? 'panel' : 'panels';
        var canEdit = this.props.dashboard.meta.canEdit === true;
        return (React.createElement("div", { className: classes },
            React.createElement("a", { className: "dashboard-row__title pointer", onClick: this.onToggle },
                React.createElement(Icon, { name: this.state.collapsed ? 'angle-right' : 'angle-down' }),
                title,
                React.createElement("span", { className: "dashboard-row__panel_count" },
                    "(",
                    count,
                    " ",
                    panels,
                    ")")),
            canEdit && (React.createElement("div", { className: "dashboard-row__actions" },
                React.createElement(RowOptionsButton, { title: this.props.panel.title, repeat: this.props.panel.repeat, onUpdate: this.onUpdate }),
                React.createElement("a", { className: "pointer", onClick: this.onDelete },
                    React.createElement(Icon, { name: "trash-alt" })))),
            this.state.collapsed === true && (React.createElement("div", { className: "dashboard-row__toggle-target", onClick: this.onToggle }, "\u00A0")),
            canEdit && React.createElement("div", { className: "dashboard-row__drag grid-drag-handle" })));
    };
    return DashboardRow;
}(React.Component));
export { DashboardRow };
//# sourceMappingURL=DashboardRow.js.map