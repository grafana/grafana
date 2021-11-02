import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { VisualizationButton } from './VisualizationButton';
import { OptionsPaneOptions } from './OptionsPaneOptions';
import { useSelector } from 'react-redux';
import { VisualizationSelectPane } from './VisualizationSelectPane';
import { usePanelLatestData } from './usePanelLatestData';
export var OptionsPane = function (_a) {
    var plugin = _a.plugin, panel = _a.panel, onFieldConfigsChange = _a.onFieldConfigsChange, onPanelOptionsChanged = _a.onPanelOptionsChanged, onPanelConfigChange = _a.onPanelConfigChange, dashboard = _a.dashboard, instanceState = _a.instanceState;
    var styles = useStyles(getStyles);
    var isVizPickerOpen = useSelector(function (state) { return state.panelEditor.isVizPickerOpen; });
    var data = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false }, true).data;
    return (React.createElement("div", { className: styles.wrapper, "aria-label": selectors.components.PanelEditor.OptionsPane.content },
        !isVizPickerOpen && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.vizButtonWrapper },
                React.createElement(VisualizationButton, { panel: panel })),
            React.createElement("div", { className: styles.optionsWrapper },
                React.createElement(OptionsPaneOptions, { panel: panel, dashboard: dashboard, plugin: plugin, instanceState: instanceState, data: data, onFieldConfigsChange: onFieldConfigsChange, onPanelOptionsChanged: onPanelOptionsChanged, onPanelConfigChange: onPanelConfigChange })))),
        isVizPickerOpen && React.createElement(VisualizationSelectPane, { panel: panel, data: data })));
};
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      height: 100%;\n      width: 100%;\n      display: flex;\n      flex: 1 1 0;\n      flex-direction: column;\n      padding: 0;\n    "], ["\n      height: 100%;\n      width: 100%;\n      display: flex;\n      flex: 1 1 0;\n      flex-direction: column;\n      padding: 0;\n    "]))),
        optionsWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      flex-grow: 1;\n      min-height: 0;\n    "], ["\n      flex-grow: 1;\n      min-height: 0;\n    "]))),
        vizButtonWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding: 0 ", " ", " 0;\n    "], ["\n      padding: 0 ", " ", " 0;\n    "])), theme.spacing.md, theme.spacing.md),
        legacyOptions: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: legacy-options;\n      .panel-options-grid {\n        display: flex;\n        flex-direction: column;\n      }\n      .panel-options-group {\n        margin-bottom: 0;\n      }\n      .panel-options-group__body {\n        padding: ", " 0;\n      }\n\n      .section {\n        display: block;\n        margin: ", " 0;\n\n        &:first-child {\n          margin-top: 0;\n        }\n      }\n    "], ["\n      label: legacy-options;\n      .panel-options-grid {\n        display: flex;\n        flex-direction: column;\n      }\n      .panel-options-group {\n        margin-bottom: 0;\n      }\n      .panel-options-group__body {\n        padding: ", " 0;\n      }\n\n      .section {\n        display: block;\n        margin: ", " 0;\n\n        &:first-child {\n          margin-top: 0;\n        }\n      }\n    "])), theme.spacing.md, theme.spacing.md),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=OptionsPane.js.map