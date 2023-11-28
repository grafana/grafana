import { css } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';
import { useLocalStorage } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Button, CustomScrollbar, FilterInput, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { Field } from '@grafana/ui/src/components/Forms/Field';
import { LS_VISUALIZATION_SELECT_TAB_KEY, LS_WIDGET_SELECT_TAB_KEY } from 'app/core/constants';
import { PanelLibraryOptionsGroup } from 'app/features/library-panels/components/PanelLibraryOptionsGroup/PanelLibraryOptionsGroup';
import { VisualizationSuggestions } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestions';
import { useDispatch, useSelector } from 'app/types';
import { VizTypePicker } from '../../../panel/components/VizTypePicker/VizTypePicker';
import { changePanelPlugin } from '../../../panel/state/actions';
import { getPanelPluginWithFallback } from '../../state/selectors';
import { toggleVizPicker } from './state/reducers';
import { VisualizationSelectPaneTab } from './types';
export const VisualizationSelectPane = ({ panel, data }) => {
    const plugin = useSelector(getPanelPluginWithFallback(panel.type));
    const [searchQuery, setSearchQuery] = useState('');
    // Add support to show widgets in the visualization picker
    const isWidget = !!plugin.meta.skipDataQuery;
    const isWidgetEnabled = Boolean(isWidget && config.featureToggles.vizAndWidgetSplit);
    const tabKey = isWidgetEnabled ? LS_WIDGET_SELECT_TAB_KEY : LS_VISUALIZATION_SELECT_TAB_KEY;
    const defaultTab = isWidgetEnabled ? VisualizationSelectPaneTab.Widgets : VisualizationSelectPaneTab.Visualizations;
    const [listMode, setListMode] = useLocalStorage(tabKey, defaultTab);
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const searchRef = useRef(null);
    const onVizChange = useCallback((pluginChange) => {
        dispatch(changePanelPlugin(Object.assign({ panel: panel }, pluginChange)));
        // close viz picker unless a mod key is pressed while clicking
        if (!pluginChange.withModKey) {
            dispatch(toggleVizPicker(false));
        }
    }, [dispatch, panel]);
    const onCloseVizPicker = () => {
        dispatch(toggleVizPicker(false));
    };
    if (!plugin) {
        return null;
    }
    const radioOptions = [
        { label: 'Visualizations', value: VisualizationSelectPaneTab.Visualizations },
        { label: 'Suggestions', value: VisualizationSelectPaneTab.Suggestions },
        {
            label: 'Library panels',
            value: VisualizationSelectPaneTab.LibraryPanels,
            description: 'Reusable panels you can share between multiple dashboards.',
        },
    ];
    const radioOptionsWidgetFlow = [
        { label: 'Widgets', value: VisualizationSelectPaneTab.Widgets },
        {
            label: 'Library panels',
            value: VisualizationSelectPaneTab.LibraryPanels,
            description: 'Reusable panels you can share between multiple dashboards.',
        },
    ];
    return (React.createElement("div", { className: styles.openWrapper },
        React.createElement("div", { className: styles.formBox },
            React.createElement("div", { className: styles.searchRow },
                React.createElement(FilterInput, { value: searchQuery, onChange: setSearchQuery, ref: searchRef, autoFocus: true, placeholder: "Search for..." }),
                React.createElement(Button, { title: "Close", variant: "secondary", icon: "angle-up", className: styles.closeButton, "aria-label": selectors.components.PanelEditor.toggleVizPicker, onClick: onCloseVizPicker })),
            React.createElement(Field, { className: styles.customFieldMargin },
                React.createElement(RadioButtonGroup, { options: isWidgetEnabled ? radioOptionsWidgetFlow : radioOptions, value: listMode, onChange: setListMode, fullWidth: true }))),
        React.createElement("div", { className: styles.scrollWrapper },
            React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
                React.createElement("div", { className: styles.scrollContent },
                    listMode === VisualizationSelectPaneTab.Visualizations && (React.createElement(VizTypePicker, { current: plugin.meta, onChange: onVizChange, searchQuery: searchQuery, data: data, onClose: () => { } })),
                    listMode === VisualizationSelectPaneTab.Widgets && (React.createElement(VizTypePicker, { current: plugin.meta, onChange: onVizChange, searchQuery: searchQuery, data: data, onClose: () => { }, isWidget: true })),
                    listMode === VisualizationSelectPaneTab.Suggestions && (React.createElement(VisualizationSuggestions, { current: plugin.meta, onChange: onVizChange, searchQuery: searchQuery, panel: panel, data: data, onClose: () => { } })),
                    listMode === VisualizationSelectPaneTab.LibraryPanels && (React.createElement(PanelLibraryOptionsGroup, { searchQuery: searchQuery, panel: panel, key: "Panel Library", isWidget: isWidget })))))));
};
VisualizationSelectPane.displayName = 'VisualizationSelectPane';
const getStyles = (theme) => {
    return {
        icon: css `
      color: ${theme.v1.palette.gray33};
    `,
        wrapper: css `
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      height: 100%;
    `,
        vizButton: css `
      text-align: left;
    `,
        scrollWrapper: css `
      flex-grow: 1;
      min-height: 0;
    `,
        scrollContent: css `
      padding: ${theme.spacing(1)};
    `,
        openWrapper: css `
      display: flex;
      flex-direction: column;
      flex: 1 1 100%;
      height: 100%;
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
    `,
        searchRow: css `
      display: flex;
      margin-bottom: ${theme.spacing(1)};
    `,
        closeButton: css `
      margin-left: ${theme.spacing(1)};
    `,
        customFieldMargin: css `
      margin-bottom: ${theme.spacing(1)};
    `,
        formBox: css `
      padding: ${theme.spacing(1)};
      padding-bottom: 0;
    `,
    };
};
//# sourceMappingURL=VisualizationSelectPane.js.map