import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { ToolbarButton, ButtonGroup, useStyles } from '@grafana/ui';
import { useDispatch, useSelector } from 'react-redux';
import { setPanelEditorUIState, toggleVizPicker } from './state/reducers';
import { selectors } from '@grafana/e2e-selectors';
import { getPanelPluginWithFallback } from '../../state/selectors';
export var VisualizationButton = function (_a) {
    var panel = _a.panel;
    var styles = useStyles(getStyles);
    var dispatch = useDispatch();
    var plugin = useSelector(getPanelPluginWithFallback(panel.type));
    var isPanelOptionsVisible = useSelector(function (state) { return state.panelEditor.ui.isPanelOptionsVisible; });
    var isVizPickerOpen = useSelector(function (state) { return state.panelEditor.isVizPickerOpen; });
    var onToggleOpen = function () {
        dispatch(toggleVizPicker(!isVizPickerOpen));
    };
    var onToggleOptionsPane = function () {
        dispatch(setPanelEditorUIState({ isPanelOptionsVisible: !isPanelOptionsVisible }));
    };
    if (!plugin) {
        return null;
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(ButtonGroup, null,
            React.createElement(ToolbarButton, { className: styles.vizButton, tooltip: "Click to change visualization", imgSrc: plugin.meta.info.logos.small, isOpen: isVizPickerOpen, onClick: onToggleOpen, "aria-label": selectors.components.PanelEditor.toggleVizPicker, fullWidth: true }, plugin.meta.name),
            React.createElement(ToolbarButton, { tooltip: isPanelOptionsVisible ? 'Close options pane' : 'Show options pane', icon: isPanelOptionsVisible ? 'angle-right' : 'angle-left', onClick: onToggleOptionsPane, "aria-label": selectors.components.PanelEditor.toggleVizOptions }))));
};
VisualizationButton.displayName = 'VisualizationTab';
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n    "], ["\n      display: flex;\n      flex-direction: column;\n    "]))),
        vizButton: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      text-align: left;\n    "], ["\n      text-align: left;\n    "]))),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=VisualizationButton.js.map