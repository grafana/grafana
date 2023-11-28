import classNames from 'classnames';
import { indexOf } from 'lodash';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { getTemplateSrv, RefreshEvent } from '@grafana/runtime';
import { Icon, TextLink } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/types';
import { ShowConfirmModalEvent } from '../../../../types/events';
import { RowOptionsButton } from '../RowOptions/RowOptionsButton';
export class DashboardRow extends React.Component {
    constructor() {
        super(...arguments);
        this.onVariableUpdated = () => {
            this.forceUpdate();
        };
        this.onToggle = () => {
            this.props.dashboard.toggleRow(this.props.panel);
        };
        this.getWarning = () => {
            var _a;
            const panels = !!((_a = this.props.panel.panels) === null || _a === void 0 ? void 0 : _a.length)
                ? this.props.panel.panels
                : this.props.dashboard.getRowPanels(indexOf(this.props.dashboard.panels, this.props.panel));
            const isAnyPanelUsingDashboardDS = panels.some((p) => { var _a; return ((_a = p.datasource) === null || _a === void 0 ? void 0 : _a.uid) === SHARED_DASHBOARD_QUERY; });
            if (isAnyPanelUsingDashboardDS) {
                return (React.createElement("div", null,
                    React.createElement("p", null,
                        "Panels in this row use the ",
                        SHARED_DASHBOARD_QUERY,
                        " data source. These panels will reference the panel in the original row, not the ones in the repeated rows."),
                    React.createElement(TextLink, { external: true, href: 'https://grafana.com/docs/grafana/next/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows' }, "Learn more")));
            }
            return undefined;
        };
        this.onUpdate = (title, repeat) => {
            this.props.panel.setProperty('title', title);
            this.props.panel.setProperty('repeat', repeat !== null && repeat !== void 0 ? repeat : undefined);
            this.props.panel.render();
            this.props.dashboard.processRepeats();
            this.forceUpdate();
        };
        this.onDelete = () => {
            appEvents.publish(new ShowConfirmModalEvent({
                title: 'Delete row',
                text: 'Are you sure you want to remove this row and all its panels?',
                altActionText: 'Delete row only',
                icon: 'trash-alt',
                onConfirm: () => {
                    this.props.dashboard.removeRow(this.props.panel, true);
                },
                onAltAction: () => {
                    this.props.dashboard.removeRow(this.props.panel, false);
                },
            }));
        };
    }
    componentDidMount() {
        this.sub = this.props.dashboard.events.subscribe(RefreshEvent, this.onVariableUpdated);
    }
    componentWillUnmount() {
        if (this.sub) {
            this.sub.unsubscribe();
        }
    }
    render() {
        const classes = classNames({
            'dashboard-row': true,
            'dashboard-row--collapsed': this.props.panel.collapsed,
        });
        const title = getTemplateSrv().replace(this.props.panel.title, this.props.panel.scopedVars, 'text');
        const count = this.props.panel.panels ? this.props.panel.panels.length : 0;
        const panels = count === 1 ? 'panel' : 'panels';
        const canEdit = this.props.dashboard.meta.canEdit === true;
        return (React.createElement("div", { className: classes, "data-testid": "dashboard-row-container" },
            React.createElement("button", { className: "dashboard-row__title pointer", type: "button", "data-testid": selectors.components.DashboardRow.title(title), onClick: this.onToggle },
                React.createElement(Icon, { name: this.props.panel.collapsed ? 'angle-right' : 'angle-down' }),
                title,
                React.createElement("span", { className: "dashboard-row__panel_count" },
                    "(",
                    count,
                    " ",
                    panels,
                    ")")),
            canEdit && (React.createElement("div", { className: "dashboard-row__actions" },
                React.createElement(RowOptionsButton, { title: this.props.panel.title, repeat: this.props.panel.repeat, onUpdate: this.onUpdate, warning: this.getWarning() }),
                React.createElement("button", { type: "button", className: "pointer", onClick: this.onDelete, "aria-label": "Delete row" },
                    React.createElement(Icon, { name: "trash-alt" })))),
            this.props.panel.collapsed === true && (
            /* disabling the a11y rules here as the button handles keyboard interactions */
            /* this is just to provide a better experience for mouse users */
            /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
            React.createElement("div", { className: "dashboard-row__toggle-target", onClick: this.onToggle }, "\u00A0")),
            canEdit && React.createElement("div", { "data-testid": "dashboard-row-drag", className: "dashboard-row__drag grid-drag-handle" })));
    }
}
//# sourceMappingURL=DashboardRow.js.map