import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Icon, useStyles2 } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import PanelHeaderCorner from './PanelHeaderCorner';
import { getPanelLinksSupplier } from 'app/angular/panel/panellinks/linkSuppliers';
import { PanelHeaderNotices } from './PanelHeaderNotices';
import { PanelHeaderMenuTrigger } from './PanelHeaderMenuTrigger';
import { PanelHeaderLoadingIndicator } from './PanelHeaderLoadingIndicator';
import { PanelHeaderMenuWrapper } from './PanelHeaderMenuWrapper';
export var PanelHeader = function (_a) {
    var panel = _a.panel, error = _a.error, isViewing = _a.isViewing, isEditing = _a.isEditing, data = _a.data, alertState = _a.alertState, dashboard = _a.dashboard;
    var onCancelQuery = function () { return panel.getQueryRunner().cancelQuery(); };
    var title = panel.getDisplayTitle();
    var className = cx('panel-header', !(isViewing || isEditing) ? 'grid-drag-handle' : '');
    var styles = useStyles2(panelStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement(PanelHeaderLoadingIndicator, { state: data.state, onClick: onCancelQuery }),
        React.createElement(PanelHeaderCorner, { panel: panel, title: panel.title, description: panel.description, scopedVars: panel.scopedVars, links: getPanelLinksSupplier(panel), error: error }),
        React.createElement("div", { className: className },
            React.createElement(PanelHeaderMenuTrigger, { "data-testid": selectors.components.Panels.Panel.title(title) }, function (_a) {
                var closeMenu = _a.closeMenu, panelMenuOpen = _a.panelMenuOpen;
                return (React.createElement("div", { className: "panel-title" },
                    React.createElement(PanelHeaderNotices, { frames: data.series, panelId: panel.id }),
                    alertState ? (React.createElement(Icon, { name: alertState === 'alerting' ? 'heart-break' : 'heart', className: "icon-gf panel-alert-icon", style: { marginRight: '4px' }, size: "sm" })) : null,
                    React.createElement("h2", { className: styles.titleText }, title),
                    React.createElement(Icon, { name: "angle-down", className: "panel-menu-toggle" }),
                    React.createElement(PanelHeaderMenuWrapper, { panel: panel, dashboard: dashboard, show: panelMenuOpen, onClose: closeMenu }),
                    data.request && data.request.timeInfo && (React.createElement("span", { className: "panel-time-info" },
                        React.createElement(Icon, { name: "clock-nine", size: "sm" }),
                        " ",
                        data.request.timeInfo))));
            }))));
};
var panelStyles = function (theme) {
    return {
        titleText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n      max-width: calc(100% - 38px);\n      cursor: pointer;\n      font-weight: ", ";\n      font-size: ", ";\n      margin: 0;\n\n      &:hover {\n        color: ", ";\n      }\n      .panel-has-alert & {\n        max-width: calc(100% - 54px);\n      }\n    "], ["\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n      max-width: calc(100% - 38px);\n      cursor: pointer;\n      font-weight: ", ";\n      font-size: ", ";\n      margin: 0;\n\n      &:hover {\n        color: ", ";\n      }\n      .panel-has-alert & {\n        max-width: calc(100% - 54px);\n      }\n    "])), theme.typography.fontWeightMedium, theme.typography.body.fontSize, theme.colors.text.primary),
    };
};
var templateObject_1;
//# sourceMappingURL=PanelHeader.js.map