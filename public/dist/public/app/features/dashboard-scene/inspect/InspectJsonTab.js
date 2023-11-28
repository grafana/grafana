import { isEqual } from 'lodash';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { selectors } from '@grafana/e2e-selectors';
import { SceneDataTransformer, sceneGraph, SceneGridItem, SceneObjectBase, sceneUtils, } from '@grafana/scenes';
import { Button, CodeEditor, Field, Select, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getPanelDataFrames } from 'app/features/dashboard/components/HelpWizard/utils';
import { PanelModel } from 'app/features/dashboard/state';
import { getPanelInspectorStyles2 } from 'app/features/inspector/styles';
import { InspectTab } from 'app/features/inspector/types';
import { getPrettyJSON } from 'app/features/inspector/utils/utils';
import { reportPanelInspectInteraction } from 'app/features/search/page/reporting';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { buildGridItemForPanel } from '../serialization/transformSaveModelToScene';
import { gridItemToPanel } from '../serialization/transformSceneToSaveModel';
import { getDashboardSceneFor, getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';
export class InspectJsonTab extends SceneObjectBase {
    constructor(state) {
        super(Object.assign(Object.assign({}, state), { source: 'panel-json', jsonText: getJsonText('panel-json', state.panelRef.resolve()) }));
        this.onChangeSource = (value) => {
            this.setState({ source: value.value, jsonText: getJsonText(value.value, this.state.panelRef.resolve()) });
        };
        this.onApplyChange = () => {
            const panel = this.state.panelRef.resolve();
            const dashboard = getDashboardSceneFor(panel);
            const jsonObj = JSON.parse(this.state.jsonText);
            const panelModel = new PanelModel(jsonObj);
            const gridItem = buildGridItemForPanel(panelModel);
            const newState = sceneUtils.cloneSceneObjectState(gridItem.state);
            if (!(panel.parent instanceof SceneGridItem) || !(gridItem instanceof SceneGridItem)) {
                console.error('Cannot update state of panel', panel, gridItem);
                return;
            }
            this.state.onClose();
            if (!dashboard.state.isEditing) {
                dashboard.onEnterEditMode();
            }
            panel.parent.setState(newState);
            //Report relevant updates
            reportPanelInspectInteraction(InspectTab.JSON, 'apply', {
                panel_type_changed: panel.state.pluginId !== panelModel.type,
                panel_id_changed: getPanelIdForVizPanel(panel) !== panelModel.id,
                panel_grid_pos_changed: hasGridPosChanged(panel.parent.state, newState),
                panel_targets_changed: hasQueriesChanged(getQueryRunnerFor(panel), getQueryRunnerFor(newState.$data)),
            });
        };
        this.onCodeEditorBlur = (value) => {
            this.setState({ jsonText: value });
        };
    }
    getTabLabel() {
        return t('dashboard.inspect.json-tab', 'JSON');
    }
    getTabValue() {
        return InspectTab.JSON;
    }
    getOptions() {
        const panel = this.state.panelRef.resolve();
        const dataProvider = panel.state.$data;
        const options = [
            {
                label: t('dashboard.inspect-json.panel-json-label', 'Panel JSON'),
                description: t('dashboard.inspect-json.panel-json-description', 'The model saved in the dashboard JSON that configures how everything works.'),
                value: 'panel-json',
            },
        ];
        if (dataProvider) {
            options.push({
                label: t('dashboard.inspect-json.panel-data-label', 'Panel data'),
                description: t('dashboard.inspect-json.panel-data-description', 'The raw model passed to the panel visualization'),
                value: 'panel-data',
            });
            options.push({
                label: t('dashboard.inspect-json.dataframe-label', 'DataFrame JSON (from Query)'),
                description: t('dashboard.inspect-json.dataframe-description', 'Raw data without transformations and field config applied. '),
                value: 'data-frames',
            });
        }
        return options;
    }
    isEditable() {
        if (this.state.source !== 'panel-json') {
            return false;
        }
        const panel = this.state.panelRef.resolve();
        // Only support normal grid items for now and not repeated items
        if (!(panel.parent instanceof SceneGridItem)) {
            return false;
        }
        const dashboard = getDashboardSceneFor(panel);
        return dashboard.state.meta.canEdit;
    }
}
InspectJsonTab.Component = ({ model }) => {
    var _a;
    const { source: show, jsonText } = model.useState();
    const styles = useStyles2(getPanelInspectorStyles2);
    const options = model.getOptions();
    return (React.createElement("div", { className: styles.wrap },
        React.createElement("div", { className: styles.toolbar, "aria-label": selectors.components.PanelInspector.Json.content },
            React.createElement(Field, { label: t('dashboard.inspect-json.select-source', 'Select source'), className: "flex-grow-1" },
                React.createElement(Select, { inputId: "select-source-dropdown", options: options, value: (_a = options.find((v) => v.value === show)) !== null && _a !== void 0 ? _a : options[0].value, onChange: model.onChangeSource })),
            model.isEditable() && (React.createElement(Button, { className: styles.toolbarItem, onClick: model.onApplyChange }, "Apply"))),
        React.createElement("div", { className: styles.content },
            React.createElement(AutoSizer, { disableWidth: true }, ({ height }) => (React.createElement(CodeEditor, { width: "100%", height: height, language: "json", showLineNumbers: true, showMiniMap: jsonText.length > 100, value: jsonText, readOnly: !model.isEditable(), onBlur: model.onCodeEditorBlur }))))));
};
function getJsonText(show, panel) {
    var _a;
    let objToStringify = {};
    switch (show) {
        case 'panel-json': {
            reportPanelInspectInteraction(InspectTab.JSON, 'panelData');
            if (panel.parent instanceof SceneGridItem || panel.parent instanceof PanelRepeaterGridItem) {
                objToStringify = gridItemToPanel(panel.parent);
            }
            break;
        }
        case 'panel-data': {
            reportPanelInspectInteraction(InspectTab.JSON, 'panelJSON');
            const dataProvider = sceneGraph.getData(panel);
            if (dataProvider.state.data) {
                objToStringify = panel.applyFieldConfig(dataProvider.state.data);
            }
            break;
        }
        case 'data-frames': {
            reportPanelInspectInteraction(InspectTab.JSON, 'dataFrame');
            const dataProvider = sceneGraph.getData(panel);
            if (dataProvider.state.data) {
                // Get raw untransformed data
                if (dataProvider instanceof SceneDataTransformer && ((_a = dataProvider.state.$data) === null || _a === void 0 ? void 0 : _a.state.data)) {
                    objToStringify = getPanelDataFrames(dataProvider.state.$data.state.data);
                }
                else {
                    objToStringify = getPanelDataFrames(dataProvider.state.data);
                }
            }
        }
    }
    return getPrettyJSON(objToStringify);
}
function hasGridPosChanged(a, b) {
    return a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height;
}
function hasQueriesChanged(a, b) {
    if (a === undefined || b === undefined) {
        return false;
    }
    return !isEqual(a.state.queries, b.state.queries);
}
//# sourceMappingURL=InspectJsonTab.js.map