import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { Button, CustomScrollbar, FilterInput, RadioButtonGroup, useStyles } from '@grafana/ui';
import { changePanelPlugin } from '../../../panel/state/actions';
import { useDispatch, useSelector } from 'react-redux';
import { VizTypePicker } from '../../../panel/components/VizTypePicker/VizTypePicker';
import { Field } from '@grafana/ui/src/components/Forms/Field';
import { PanelLibraryOptionsGroup } from 'app/features/library-panels/components/PanelLibraryOptionsGroup/PanelLibraryOptionsGroup';
import { toggleVizPicker } from './state/reducers';
import { selectors } from '@grafana/e2e-selectors';
import { getPanelPluginWithFallback } from '../../state/selectors';
import { VisualizationSuggestions } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestions';
import { useLocalStorage } from 'react-use';
export var VisualizationSelectPane = function (_a) {
    var panel = _a.panel, data = _a.data;
    var plugin = useSelector(getPanelPluginWithFallback(panel.type));
    var _b = __read(useState(''), 2), searchQuery = _b[0], setSearchQuery = _b[1];
    var _c = __read(useLocalStorage("VisualizationSelectPane.ListMode", ListMode.Visualizations), 2), listMode = _c[0], setListMode = _c[1];
    var dispatch = useDispatch();
    var styles = useStyles(getStyles);
    var searchRef = useRef(null);
    var onVizChange = useCallback(function (pluginChange) {
        dispatch(changePanelPlugin(__assign({ panel: panel }, pluginChange)));
        // close viz picker unless a mod key is pressed while clicking
        if (!pluginChange.withModKey) {
            dispatch(toggleVizPicker(false));
        }
    }, [dispatch, panel]);
    // Give Search input focus when using radio button switch list mode
    useEffect(function () {
        if (searchRef.current) {
            searchRef.current.focus();
        }
    }, [listMode]);
    var onCloseVizPicker = function () {
        dispatch(toggleVizPicker(false));
    };
    // const onKeyPress = useCallback(
    //   (e: React.KeyboardEvent<HTMLInputElement>) => {
    //     if (e.key === 'Enter') {
    //       const query = e.currentTarget.value;
    //       const plugins = getAllPanelPluginMeta();
    //       const match = filterPluginList(plugins, query, plugin.meta);
    //       if (match && match.length) {
    //         onPluginTypeChange(match[0], false);
    //       }
    //     }
    //   },
    //   [onPluginTypeChange, plugin.meta]
    // );
    if (!plugin) {
        return null;
    }
    var radioOptions = [
        { label: 'Visualizations', value: ListMode.Visualizations },
        { label: 'Suggestions', value: ListMode.Suggestions },
        {
            label: 'Library panels',
            value: ListMode.LibraryPanels,
            description: 'Reusable panels you can share between multiple dashboards.',
        },
    ];
    return (React.createElement("div", { className: styles.openWrapper },
        React.createElement("div", { className: styles.formBox },
            React.createElement("div", { className: styles.searchRow },
                React.createElement(FilterInput, { value: searchQuery, onChange: setSearchQuery, ref: searchRef, autoFocus: true, placeholder: "Search for..." }),
                React.createElement(Button, { title: "Close", variant: "secondary", icon: "angle-up", className: styles.closeButton, "aria-label": selectors.components.PanelEditor.toggleVizPicker, onClick: onCloseVizPicker })),
            React.createElement(Field, { className: styles.customFieldMargin },
                React.createElement(RadioButtonGroup, { options: radioOptions, value: listMode, onChange: setListMode, fullWidth: true }))),
        React.createElement("div", { className: styles.scrollWrapper },
            React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
                React.createElement("div", { className: styles.scrollContent },
                    listMode === ListMode.Visualizations && (React.createElement(VizTypePicker, { current: plugin.meta, onChange: onVizChange, searchQuery: searchQuery, data: data, onClose: function () { } })),
                    listMode === ListMode.Suggestions && (React.createElement(VisualizationSuggestions, { current: plugin.meta, onChange: onVizChange, searchQuery: searchQuery, panel: panel, data: data, onClose: function () { } })),
                    listMode === ListMode.LibraryPanels && (React.createElement(PanelLibraryOptionsGroup, { searchQuery: searchQuery, panel: panel, key: "Panel Library" })))))));
};
var ListMode;
(function (ListMode) {
    ListMode[ListMode["Visualizations"] = 0] = "Visualizations";
    ListMode[ListMode["LibraryPanels"] = 1] = "LibraryPanels";
    ListMode[ListMode["Suggestions"] = 2] = "Suggestions";
})(ListMode || (ListMode = {}));
VisualizationSelectPane.displayName = 'VisualizationSelectPane';
var getStyles = function (theme) {
    return {
        icon: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.palette.gray33),
        wrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      flex: 1 1 0;\n      height: 100%;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      flex: 1 1 0;\n      height: 100%;\n    "]))),
        vizButton: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      text-align: left;\n    "], ["\n      text-align: left;\n    "]))),
        scrollWrapper: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      flex-grow: 1;\n      min-height: 0;\n    "], ["\n      flex-grow: 1;\n      min-height: 0;\n    "]))),
        scrollContent: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing.sm),
        openWrapper: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      flex: 1 1 100%;\n      height: 100%;\n      background: ", ";\n      border: 1px solid ", ";\n    "], ["\n      display: flex;\n      flex-direction: column;\n      flex: 1 1 100%;\n      height: 100%;\n      background: ", ";\n      border: 1px solid ", ";\n    "])), theme.colors.bg1, theme.colors.border1),
        searchRow: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      display: flex;\n      margin-bottom: ", ";\n    "], ["\n      display: flex;\n      margin-bottom: ", ";\n    "])), theme.spacing.sm),
        closeButton: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing.sm),
        customFieldMargin: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.sm),
        formBox: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      padding: ", ";\n      padding-bottom: 0;\n    "], ["\n      padding: ", ";\n      padding-bottom: 0;\n    "])), theme.spacing.sm),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
//# sourceMappingURL=VisualizationSelectPane.js.map