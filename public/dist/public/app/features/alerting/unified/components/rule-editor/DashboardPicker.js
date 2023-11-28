import { css, cx } from '@emotion/css';
import { noop } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';
import { Alert, Button, clearButtonStyles, FilterInput, Icon, LoadingPlaceholder, Modal, Tooltip, useStyles2, } from '@grafana/ui';
import { dashboardApi } from '../../api/dashboardApi';
function panelSort(a, b) {
    if (a.title && b.title) {
        return a.title.localeCompare(b.title);
    }
    if (a.title && !b.title) {
        return 1;
    }
    else if (!a.title && b.title) {
        return -1;
    }
    return 0;
}
export function mergePanels(dashboardResult) {
    var _a, _b, _c, _d;
    const panels = ((_b = (_a = dashboardResult === null || dashboardResult === void 0 ? void 0 : dashboardResult.dashboard) === null || _a === void 0 ? void 0 : _a.panels) === null || _b === void 0 ? void 0 : _b.filter((panel) => panel.type !== 'row')) || [];
    const nestedPanels = ((_d = (_c = dashboardResult === null || dashboardResult === void 0 ? void 0 : dashboardResult.dashboard) === null || _c === void 0 ? void 0 : _c.panels) === null || _d === void 0 ? void 0 : _d.filter((row) => row.collapsed).map((collapsedRow) => collapsedRow.panels)) || [];
    const allDashboardPanels = [...panels, ...nestedPanels.flat()];
    return allDashboardPanels;
}
export const DashboardPicker = ({ dashboardUid, panelId, isOpen, onChange, onDismiss }) => {
    var _a, _b;
    const styles = useStyles2(getPickerStyles);
    const [selectedDashboardUid, setSelectedDashboardUid] = useState(dashboardUid);
    const [selectedPanelId, setSelectedPanelId] = useState(panelId);
    const [dashboardFilter, setDashboardFilter] = useState('');
    const [debouncedDashboardFilter, setDebouncedDashboardFilter] = useState('');
    const [panelFilter, setPanelFilter] = useState('');
    const { useSearchQuery, useDashboardQuery } = dashboardApi;
    const { currentData: filteredDashboards = [], isFetching: isDashSearchFetching } = useSearchQuery({
        query: debouncedDashboardFilter,
    });
    const { currentData: dashboardResult, isFetching: isDashboardFetching } = useDashboardQuery({ uid: selectedDashboardUid !== null && selectedDashboardUid !== void 0 ? selectedDashboardUid : '' }, { skip: !selectedDashboardUid });
    const handleDashboardChange = useCallback((dashboardUid) => {
        setSelectedDashboardUid(dashboardUid);
        setSelectedPanelId(undefined);
    }, []);
    const allDashboardPanels = mergePanels(dashboardResult);
    const filteredPanels = (_a = allDashboardPanels === null || allDashboardPanels === void 0 ? void 0 : allDashboardPanels.filter((panel) => { var _a; return (_a = panel.title) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(panelFilter.toLowerCase()); }).sort(panelSort)) !== null && _a !== void 0 ? _a : [];
    const currentPanel = allDashboardPanels.find((panel) => { var _a; return isValidPanelIdentifier(panel) && ((_a = panel.id) === null || _a === void 0 ? void 0 : _a.toString()) === selectedPanelId; });
    const selectedDashboardIndex = useMemo(() => {
        return filteredDashboards.map((dashboard) => dashboard.uid).indexOf(selectedDashboardUid !== null && selectedDashboardUid !== void 0 ? selectedDashboardUid : '');
    }, [filteredDashboards, selectedDashboardUid]);
    const isDefaultSelection = dashboardUid && dashboardUid === selectedDashboardUid;
    const selectedDashboardIsInPageResult = selectedDashboardIndex >= 0;
    const scrollToItem = useCallback((node) => {
        const canScroll = selectedDashboardIndex >= 0;
        if (isDefaultSelection && canScroll) {
            node === null || node === void 0 ? void 0 : node.scrollToItem(selectedDashboardIndex, 'smart');
        }
    }, [isDefaultSelection, selectedDashboardIndex]);
    useDebounce(() => {
        setDebouncedDashboardFilter(dashboardFilter);
    }, 500, [dashboardFilter]);
    const DashboardRow = ({ index, style }) => {
        var _a;
        const dashboard = filteredDashboards[index];
        const isSelected = selectedDashboardUid === dashboard.uid;
        return (React.createElement("button", { type: "button", title: dashboard.title, style: style, className: cx(styles.rowButton, { [styles.rowOdd]: index % 2 === 1, [styles.rowSelected]: isSelected }), onClick: () => handleDashboardChange(dashboard.uid) },
            React.createElement("div", { className: cx(styles.dashboardTitle, styles.rowButtonTitle) }, dashboard.title),
            React.createElement("div", { className: styles.dashboardFolder },
                React.createElement(Icon, { name: "folder" }),
                " ", (_a = dashboard.folderTitle) !== null && _a !== void 0 ? _a : 'General')));
    };
    const PanelRow = ({ index, style }) => {
        var _a;
        const panel = filteredPanels[index];
        const panelTitle = panel.title || '<No title>';
        const isSelected = panel.id && selectedPanelId === ((_a = panel.id) === null || _a === void 0 ? void 0 : _a.toString());
        const isAlertingCompatible = panel.type === 'graph' || panel.type === 'timeseries';
        const disabled = !isValidPanelIdentifier(panel);
        return (React.createElement("button", { type: "button", style: style, disabled: disabled, className: cx(styles.rowButton, styles.panelButton, {
                [styles.rowOdd]: index % 2 === 1,
                [styles.rowSelected]: isSelected,
            }), onClick: () => { var _a; return (disabled ? noop : setSelectedPanelId((_a = panel.id) === null || _a === void 0 ? void 0 : _a.toString())); } },
            React.createElement("div", { className: styles.rowButtonTitle, title: panelTitle }, panelTitle),
            !isAlertingCompatible && !disabled && (React.createElement(Tooltip, { content: "Alert tab will be disabled for this panel. It is only supported on graph and timeseries panels" },
                React.createElement(Icon, { name: "exclamation-triangle", className: styles.warnIcon, "data-testid": "warning-icon" }))),
            disabled && (React.createElement(Tooltip, { content: "This panel does not have a valid identifier." },
                React.createElement(Icon, { name: "info-circle", "data-testid": "info-icon" })))));
    };
    return (React.createElement(Modal, { title: "Select dashboard and panel", closeOnEscape: true, isOpen: isOpen, onDismiss: onDismiss, className: styles.modal, contentClassName: styles.modalContent },
        !selectedDashboardIsInPageResult && dashboardUid && (React.createElement(Alert, { title: "Current selection", severity: "info", topSpacing: 0, bottomSpacing: 1, className: styles.modalAlert },
            React.createElement("div", null,
                "Dashboard: ", dashboardResult === null || dashboardResult === void 0 ? void 0 :
                dashboardResult.dashboard.title,
                " (", dashboardResult === null || dashboardResult === void 0 ? void 0 :
                dashboardResult.dashboard.uid,
                ") in folder",
                ' ', (_b = dashboardResult === null || dashboardResult === void 0 ? void 0 : dashboardResult.meta.folderTitle) !== null && _b !== void 0 ? _b : 'General'),
            currentPanel && (React.createElement("div", null,
                "Panel: ",
                currentPanel.title,
                " (",
                currentPanel.id,
                ")")))),
        React.createElement("div", { className: styles.container },
            React.createElement(FilterInput, { value: dashboardFilter, onChange: setDashboardFilter, title: "Search dashboard", placeholder: "Search dashboard", autoFocus: true }),
            React.createElement(FilterInput, { value: panelFilter, onChange: setPanelFilter, title: "Search panel", placeholder: "Search panel" }),
            React.createElement("div", { className: styles.column },
                isDashSearchFetching && (React.createElement(LoadingPlaceholder, { text: "Loading dashboards...", className: styles.loadingPlaceholder })),
                !isDashSearchFetching && (React.createElement(AutoSizer, null, ({ height, width }) => (React.createElement(FixedSizeList, { ref: scrollToItem, itemSize: 50, height: height, width: width, itemCount: filteredDashboards.length }, DashboardRow))))),
            React.createElement("div", { className: styles.column },
                !selectedDashboardUid && !isDashboardFetching && (React.createElement("div", { className: styles.selectDashboardPlaceholder },
                    React.createElement("div", null, "Select a dashboard to get a list of available panels"))),
                isDashboardFetching && (React.createElement(LoadingPlaceholder, { text: "Loading dashboard...", className: styles.loadingPlaceholder })),
                selectedDashboardUid && !isDashboardFetching && (React.createElement(AutoSizer, null, ({ width, height }) => (React.createElement(FixedSizeList, { itemSize: 32, height: height, width: width, itemCount: filteredPanels.length }, PanelRow)))))),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { type: "button", variant: "secondary", onClick: onDismiss, fill: "text" }, "Cancel"),
            React.createElement(Button, { type: "button", variant: "primary", disabled: !(selectedDashboardUid && selectedPanelId), onClick: () => {
                    if (selectedDashboardUid && selectedPanelId) {
                        onChange(selectedDashboardUid, selectedPanelId);
                    }
                } }, "Confirm"))));
};
const isValidPanelIdentifier = (panel) => {
    return typeof panel.id === 'number' && typeof panel.type === 'string';
};
const getPickerStyles = (theme) => {
    const clearButton = clearButtonStyles(theme);
    return {
        container: css `
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: min-content auto;
      gap: ${theme.spacing(2)};
      flex: 1;
    `,
        column: css `
      flex: 1 1 auto;
    `,
        dashboardTitle: css `
      height: 22px;
      font-weight: ${theme.typography.fontWeightBold};
    `,
        dashboardFolder: css `
      height: 20px;
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
      column-gap: ${theme.spacing(1)};
      align-items: center;
    `,
        rowButton: css `
      ${clearButton};
      padding: ${theme.spacing(0.5)};
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
      border: 2px solid transparent;

      &:disabled {
        cursor: not-allowed;
        color: ${theme.colors.text.disabled};
      }
    `,
        rowButtonTitle: css `
      text-overflow: ellipsis;
      overflow: hidden;
    `,
        rowSelected: css `
      border-color: ${theme.colors.primary.border};
    `,
        rowOdd: css `
      background-color: ${theme.colors.background.secondary};
    `,
        panelButton: css `
      display: flex;
      gap: ${theme.spacing(1)};
      justify-content: space-between;
      align-items: center;
    `,
        loadingPlaceholder: css `
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    `,
        selectDashboardPlaceholder: css `
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      font-weight: ${theme.typography.fontWeightBold};
    `,
        modal: css `
      height: 100%;
    `,
        modalContent: css `
      flex: 1;
      display: flex;
      flex-direction: column;
    `,
        modalAlert: css `
      flex-grow: 0;
    `,
        warnIcon: css `
      fill: ${theme.colors.warning.main};
    `,
    };
};
//# sourceMappingURL=DashboardPicker.js.map