import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { css, cx, keyframes } from '@emotion/css';
import { chain, cloneDeep, defaults, find, sortBy } from 'lodash';
import tinycolor from 'tinycolor2';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Icon, IconButton, styleMixins, useStyles2 } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import config from 'app/core/config';
import store from 'app/core/store';
import { addPanel } from 'app/features/dashboard/state/reducers';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { toPanelModelLibraryPanel } from '../../../library-panels/utils';
import { LibraryPanelsSearch, LibraryPanelsSearchVariant, } from '../../../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
var getCopiedPanelPlugins = function () {
    var panels = chain(config.panels)
        .filter({ hideFromList: false })
        .map(function (item) { return item; })
        .value();
    var copiedPanels = [];
    var copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
    if (copiedPanelJson) {
        var copiedPanel = JSON.parse(copiedPanelJson);
        var pluginInfo = find(panels, { id: copiedPanel.type });
        if (pluginInfo) {
            var pluginCopy = cloneDeep(pluginInfo);
            pluginCopy.name = copiedPanel.title;
            pluginCopy.sort = -1;
            pluginCopy.defaults = copiedPanel;
            copiedPanels.push(pluginCopy);
        }
    }
    return sortBy(copiedPanels, 'sort');
};
export var AddPanelWidgetUnconnected = function (_a) {
    var panel = _a.panel, dashboard = _a.dashboard;
    var _b = __read(useState(false), 2), addPanelView = _b[0], setAddPanelView = _b[1];
    var onCancelAddPanel = function (evt) {
        evt.preventDefault();
        dashboard.removePanel(panel);
    };
    var onBack = function () {
        setAddPanelView(false);
    };
    var onCreateNewPanel = function () {
        var gridPos = panel.gridPos;
        var newPanel = {
            type: 'timeseries',
            title: 'Panel Title',
            gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
        };
        dashboard.addPanel(newPanel);
        dashboard.removePanel(panel);
        locationService.partial({ editPanel: newPanel.id });
    };
    var onPasteCopiedPanel = function (panelPluginInfo) {
        var gridPos = panel.gridPos;
        var newPanel = {
            type: panelPluginInfo.id,
            title: 'Panel Title',
            gridPos: {
                x: gridPos.x,
                y: gridPos.y,
                w: panelPluginInfo.defaults.gridPos.w,
                h: panelPluginInfo.defaults.gridPos.h,
            },
        };
        // apply panel template / defaults
        if (panelPluginInfo.defaults) {
            defaults(newPanel, panelPluginInfo.defaults);
            newPanel.title = panelPluginInfo.defaults.title;
            store.delete(LS_PANEL_COPY_KEY);
        }
        dashboard.addPanel(newPanel);
        dashboard.removePanel(panel);
    };
    var onAddLibraryPanel = function (panelInfo) {
        var gridPos = panel.gridPos;
        var newPanel = __assign(__assign({}, panelInfo.model), { gridPos: gridPos, libraryPanel: toPanelModelLibraryPanel(panelInfo) });
        dashboard.addPanel(newPanel);
        dashboard.removePanel(panel);
    };
    var onCreateNewRow = function () {
        var newRow = {
            type: 'row',
            title: 'Row title',
            gridPos: { x: 0, y: 0 },
        };
        dashboard.addPanel(newRow);
        dashboard.removePanel(panel);
    };
    var styles = useStyles2(getStyles);
    var copiedPanelPlugins = useMemo(function () { return getCopiedPanelPlugins(); }, []);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: cx('panel-container', styles.callToAction) },
            React.createElement(AddPanelWidgetHandle, { onCancel: onCancelAddPanel, onBack: addPanelView ? onBack : undefined, styles: styles }, addPanelView ? 'Add panel from panel library' : 'Add panel'),
            addPanelView ? (React.createElement(LibraryPanelsSearch, { onClick: onAddLibraryPanel, variant: LibraryPanelsSearchVariant.Tight, showPanelFilter: true })) : (React.createElement("div", { className: styles.actionsWrapper },
                React.createElement("div", { className: cx(styles.actionsRow, styles.columnGap) },
                    React.createElement("div", { onClick: function () {
                            reportInteraction('Create new panel');
                            onCreateNewPanel();
                        }, "aria-label": selectors.pages.AddDashboard.addNewPanel },
                        React.createElement(Icon, { name: "file-blank", size: "xl" }),
                        "Add an empty panel"),
                    React.createElement("div", { className: styles.rowGap, onClick: function () {
                            reportInteraction('Create new row');
                            onCreateNewRow();
                        }, "aria-label": selectors.pages.AddDashboard.addNewRow },
                        React.createElement(Icon, { name: "wrap-text", size: "xl" }),
                        "Add a new row")),
                React.createElement("div", { className: styles.actionsRow },
                    React.createElement("div", { onClick: function () {
                            reportInteraction('Add a panel from the panel library');
                            setAddPanelView(true);
                        }, "aria-label": selectors.pages.AddDashboard.addNewPanelLibrary },
                        React.createElement(Icon, { name: "book-open", size: "xl" }),
                        "Add a panel from the panel library"),
                    copiedPanelPlugins.length === 1 && (React.createElement("div", { className: styles.rowGap, onClick: function () {
                            reportInteraction('Paste panel from clipboard');
                            onPasteCopiedPanel(copiedPanelPlugins[0]);
                        } },
                        React.createElement(Icon, { name: "clipboard-alt", size: "xl" }),
                        "Paste panel from clipboard"))))))));
};
var mapDispatchToProps = { addPanel: addPanel };
export var AddPanelWidget = connect(undefined, mapDispatchToProps)(AddPanelWidgetUnconnected);
var AddPanelWidgetHandle = function (_a) {
    var children = _a.children, onBack = _a.onBack, onCancel = _a.onCancel, styles = _a.styles;
    return (React.createElement("div", { className: cx(styles.headerRow, 'grid-drag-handle') },
        onBack && (React.createElement("div", { className: styles.backButton },
            React.createElement(IconButton, { "aria-label": "Go back", name: "arrow-left", onClick: onBack, surface: "header", size: "xl" }))),
        !onBack && (React.createElement("div", { className: styles.backButton },
            React.createElement(Icon, { name: "panel-add", size: "md" }))),
        children && React.createElement("span", null, children),
        React.createElement("div", { className: "flex-grow-1" }),
        React.createElement(IconButton, { "aria-label": "Close 'Add Panel' widget", name: "times", onClick: onCancel, surface: "header" })));
};
var getStyles = function (theme) {
    var pulsate = keyframes(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    0% {box-shadow: 0 0 0 2px ", ", 0 0 0px 4px ", ";}\n    50% {box-shadow: 0 0 0 2px ", ", 0 0 0px 4px ", ";}\n    100% {box-shadow: 0 0 0 2px ", ", 0 0 0px 4px  ", ";}\n  "], ["\n    0% {box-shadow: 0 0 0 2px ", ", 0 0 0px 4px ", ";}\n    50% {box-shadow: 0 0 0 2px ", ", 0 0 0px 4px ", ";}\n    100% {box-shadow: 0 0 0 2px ", ", 0 0 0px 4px  ", ";}\n  "])), theme.colors.background.canvas, theme.colors.primary.main, theme.components.dashboard.background, tinycolor(theme.colors.primary.main)
        .darken(20)
        .toHexString(), theme.components.dashboard.background, theme.colors.primary.main);
    return {
        // wrapper is used to make sure box-shadow animation isn't cut off in dashboard page
        wrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      height: 100%;\n      padding-top: ", ";\n    "], ["\n      height: 100%;\n      padding-top: ", ";\n    "])), theme.spacing(0.5)),
        callToAction: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      overflow: hidden;\n      outline: 2px dotted transparent;\n      outline-offset: 2px;\n      box-shadow: 0 0 0 2px black, 0 0 0px 4px #1f60c4;\n      animation: ", " 2s ease infinite;\n    "], ["\n      overflow: hidden;\n      outline: 2px dotted transparent;\n      outline-offset: 2px;\n      box-shadow: 0 0 0 2px black, 0 0 0px 4px #1f60c4;\n      animation: ", " 2s ease infinite;\n    "])), pulsate),
        rowGap: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing(1)),
        columnGap: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(1)),
        actionsRow: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      height: 100%;\n\n      > div {\n        justify-self: center;\n        cursor: pointer;\n        background: ", ";\n        border-radius: ", ";\n        color: ", ";\n        width: 100%;\n        display: flex;\n        flex-direction: column;\n        justify-content: center;\n        align-items: center;\n        text-align: center;\n\n        &:hover {\n          background: ", ";\n        }\n\n        &:hover > #book-icon {\n          background: linear-gradient(#f05a28 30%, #fbca0a 99%);\n        }\n      }\n    "], ["\n      display: flex;\n      flex-direction: row;\n      height: 100%;\n\n      > div {\n        justify-self: center;\n        cursor: pointer;\n        background: ", ";\n        border-radius: ", ";\n        color: ", ";\n        width: 100%;\n        display: flex;\n        flex-direction: column;\n        justify-content: center;\n        align-items: center;\n        text-align: center;\n\n        &:hover {\n          background: ", ";\n        }\n\n        &:hover > #book-icon {\n          background: linear-gradient(#f05a28 30%, #fbca0a 99%);\n        }\n      }\n    "])), theme.colors.background.secondary, theme.shape.borderRadius(1), theme.colors.text.primary, styleMixins.hoverColor(theme.colors.background.secondary, theme)),
        actionsWrapper: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      padding: ", ";\n      height: 100%;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      padding: ", ";\n      height: 100%;\n    "])), theme.spacing(0, 1, 1, 1)),
        headerRow: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      height: 38px;\n      flex-shrink: 0;\n      width: 100%;\n      font-size: ", ";\n      font-weight: ", ";\n      padding-left: ", ";\n      transition: background-color 0.1s ease-in-out;\n      cursor: move;\n\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      height: 38px;\n      flex-shrink: 0;\n      width: 100%;\n      font-size: ", ";\n      font-weight: ", ";\n      padding-left: ", ";\n      transition: background-color 0.1s ease-in-out;\n      cursor: move;\n\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.typography.fontSize, theme.typography.fontWeightMedium, theme.spacing(1), theme.colors.background.secondary),
        backButton: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      cursor: pointer;\n      padding-left: ", ";\n      width: ", ";\n    "], ["\n      display: flex;\n      align-items: center;\n      cursor: pointer;\n      padding-left: ", ";\n      width: ", ";\n    "])), theme.spacing(0.5), theme.spacing(4)),
        noMargin: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      margin: 0;\n    "], ["\n      margin: 0;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
//# sourceMappingURL=AddPanelWidget.js.map