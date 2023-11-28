import React from 'react';
import { LoadingState } from '@grafana/data';
import { SceneDataTransformer, sceneGraph, SceneObjectBase, } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { InspectTab } from 'app/features/inspector/types';
import { InspectDataTab as InspectDataTabOld } from '../../inspector/InspectDataTab';
export class InspectDataTab extends SceneObjectBase {
    constructor(state) {
        super(Object.assign(Object.assign({}, state), { options: {
                withTransforms: true,
                withFieldConfig: true,
            } }));
        this.onOptionsChange = (options) => {
            this.setState({ options });
        };
    }
    getTabLabel() {
        return t('dashboard.inspect.data-tab', 'Data');
    }
    getTabValue() {
        return InspectTab.Data;
    }
}
InspectDataTab.Component = ({ model }) => {
    const { options } = model.useState();
    const panel = model.state.panelRef.resolve();
    const dataProvider = sceneGraph.getData(panel);
    const { data } = getDataProviderToSubscribeTo(dataProvider, options.withTransforms).useState();
    const timeRange = sceneGraph.getTimeRange(panel);
    if (!data) {
        React.createElement("div", null, "No data found");
    }
    return (React.createElement(InspectDataTabOld, { isLoading: (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Loading, data: data === null || data === void 0 ? void 0 : data.series, options: options, hasTransformations: hasTransformations(dataProvider), timeZone: timeRange.getTimeZone(), panelPluginId: panel.state.pluginId, dataName: panel.state.title, fieldConfig: panel.state.fieldConfig, onOptionsChange: model.onOptionsChange }));
};
function hasTransformations(dataProvider) {
    if (dataProvider instanceof SceneDataTransformer) {
        return dataProvider.state.transformations.length > 0;
    }
    return false;
}
function getDataProviderToSubscribeTo(dataProvider, withTransforms) {
    if (withTransforms && dataProvider instanceof SceneDataTransformer) {
        return dataProvider.state.$data;
    }
    return dataProvider;
}
//# sourceMappingURL=InspectDataTab.js.map