import { css, cx, keyframes } from '@emotion/css';
import { chain, cloneDeep, defaults, find, sortBy } from 'lodash';
import React, { useMemo, useState } from 'react';
import { connect } from 'react-redux';
import tinycolor from 'tinycolor2';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';
import { CardButton } from 'app/core/components/CardButton';
import config from 'app/core/config';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';
import { addPanel } from 'app/features/dashboard/state/reducers';
import { LibraryPanelsSearch, LibraryPanelsSearchVariant, } from '../../../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
const getCopiedPanelPlugins = () => {
    const panels = chain(config.panels)
        .filter({ hideFromList: false })
        .map((item) => item)
        .value();
    const copiedPanels = [];
    const copiedPanelJson = store.get(LS_PANEL_COPY_KEY);
    if (copiedPanelJson) {
        const copiedPanel = JSON.parse(copiedPanelJson);
        const pluginInfo = find(panels, { id: copiedPanel.type });
        if (pluginInfo) {
            const pluginCopy = cloneDeep(pluginInfo);
            pluginCopy.name = copiedPanel.title;
            pluginCopy.sort = -1;
            pluginCopy.defaults = copiedPanel;
            copiedPanels.push(pluginCopy);
        }
    }
    return sortBy(copiedPanels, 'sort');
};
export const AddPanelWidgetUnconnected = ({ panel, dashboard }) => {
    const [addPanelView, setAddPanelView] = useState(false);
    const onCancelAddPanel = (evt) => {
        evt.preventDefault();
        dashboard.removePanel(panel);
    };
    const onBack = () => {
        setAddPanelView(false);
    };
    const onCreateNewPanel = () => {
        const { gridPos } = panel;
        const newPanel = {
            type: 'timeseries',
            title: 'Panel Title',
            datasource: panel.datasource,
            gridPos: { x: gridPos.x, y: gridPos.y, w: gridPos.w, h: gridPos.h },
            isNew: true,
        };
        dashboard.addPanel(newPanel);
        dashboard.removePanel(panel);
        locationService.partial({ editPanel: newPanel.id });
    };
    const onPasteCopiedPanel = (panelPluginInfo) => {
        const { gridPos } = panel;
        const newPanel = {
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
    const onAddLibraryPanel = (panelInfo) => {
        const { gridPos } = panel;
        const newPanel = Object.assign(Object.assign({}, panelInfo.model), { gridPos, libraryPanel: panelInfo });
        dashboard.addPanel(newPanel);
        dashboard.removePanel(panel);
    };
    const onCreateNewRow = () => {
        const newRow = {
            type: 'row',
            title: 'Row title',
            gridPos: { x: 0, y: 0 },
        };
        dashboard.addPanel(newRow);
        dashboard.removePanel(panel);
    };
    const styles = useStyles2(getStyles);
    const copiedPanelPlugins = useMemo(() => getCopiedPanelPlugins(), []);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: cx('panel-container', styles.callToAction) },
            React.createElement(AddPanelWidgetHandle, { onCancel: onCancelAddPanel, onBack: addPanelView ? onBack : undefined, styles: styles }, addPanelView ? 'Add panel from panel library' : 'Add panel'),
            addPanelView ? (React.createElement(LibraryPanelsSearch, { onClick: onAddLibraryPanel, variant: LibraryPanelsSearchVariant.Tight, showPanelFilter: true })) : (React.createElement("div", { className: styles.actionsWrapper },
                React.createElement(CardButton, { icon: "file-blank", "aria-label": selectors.pages.AddDashboard.addNewPanel, onClick: () => {
                        reportInteraction('Create new panel');
                        onCreateNewPanel();
                    } }, "Add a new panel"),
                React.createElement(CardButton, { icon: "wrap-text", "aria-label": selectors.pages.AddDashboard.addNewRow, onClick: () => {
                        reportInteraction('Create new row');
                        onCreateNewRow();
                    } }, "Add a new row"),
                React.createElement(CardButton, { icon: "book-open", "aria-label": selectors.pages.AddDashboard.addNewPanelLibrary, onClick: () => {
                        reportInteraction('Add a panel from the panel library');
                        setAddPanelView(true);
                    } }, "Add a panel from the panel library"),
                copiedPanelPlugins.length === 1 && (React.createElement(CardButton, { icon: "clipboard-alt", "aria-label": selectors.pages.AddDashboard.addNewPanelLibrary, onClick: () => {
                        reportInteraction('Paste panel from clipboard');
                        onPasteCopiedPanel(copiedPanelPlugins[0]);
                    } }, "Paste panel from clipboard")))))));
};
const mapDispatchToProps = { addPanel };
export const AddPanelWidget = connect(undefined, mapDispatchToProps)(AddPanelWidgetUnconnected);
const AddPanelWidgetHandle = ({ children, onBack, onCancel, styles }) => {
    return (React.createElement("div", { className: cx(styles.headerRow, 'grid-drag-handle') },
        onBack && (React.createElement("div", { className: styles.backButton },
            React.createElement(IconButton, { name: "arrow-left", onClick: onBack, size: "xl", tooltip: "Go back" }))),
        !onBack && (React.createElement("div", { className: styles.backButton },
            React.createElement(Icon, { name: "panel-add", size: "xl" }))),
        children && React.createElement("span", null, children),
        React.createElement("div", { className: "flex-grow-1" }),
        React.createElement(IconButton, { "aria-label": "Close 'Add Panel' widget", name: "times", onClick: onCancel, tooltip: "Close widget" })));
};
const getStyles = (theme) => {
    const pulsate = keyframes `
    0% {box-shadow: 0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main};}
    50% {box-shadow: 0 0 0 2px ${theme.components.dashboard.background}, 0 0 0px 4px ${tinycolor(theme.colors.primary.main)
        .darken(20)
        .toHexString()};}
    100% {box-shadow: 0 0 0 2px ${theme.components.dashboard.background}, 0 0 0px 4px  ${theme.colors.primary.main};}
  `;
    return {
        // wrapper is used to make sure box-shadow animation isn't cut off in dashboard page
        wrapper: css `
      height: 100%;
      padding-top: ${theme.spacing(0.5)};
    `,
        callToAction: css `
      overflow: hidden;
      outline: 2px dotted transparent;
      outline-offset: 2px;
      box-shadow:
        0 0 0 2px black,
        0 0 0px 4px #1f60c4;
      animation: ${pulsate} 2s ease infinite;
    `,
        actionsWrapper: css `
      height: 100%;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      column-gap: ${theme.spacing(1)};
      row-gap: ${theme.spacing(1)};
      padding: ${theme.spacing(0, 1, 1, 1)};

      // This is to make the last action full width (if by itself)
      & > div:nth-child(2n-1):nth-last-of-type(1) {
        grid-column: span 2;
      }
    `,
        headerRow: css `
      display: flex;
      align-items: center;
      height: 38px;
      flex-shrink: 0;
      width: 100%;
      font-size: ${theme.typography.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      padding-left: ${theme.spacing(1)};
      transition: background-color 0.1s ease-in-out;
      cursor: move;

      &:hover {
        background: ${theme.colors.background.secondary};
      }
    `,
        backButton: css `
      display: flex;
      align-items: center;
      cursor: pointer;
      padding-left: ${theme.spacing(0.5)};
      width: ${theme.spacing(4)};
    `,
        noMargin: css `
      margin: 0;
    `,
    };
};
//# sourceMappingURL=AddPanelWidget.js.map