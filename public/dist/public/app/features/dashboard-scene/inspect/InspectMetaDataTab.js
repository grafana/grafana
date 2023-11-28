import React from 'react';
import { sceneGraph, SceneObjectBase, } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { InspectTab } from 'app/features/inspector/types';
export class InspectMetaDataTab extends SceneObjectBase {
    getTabLabel() {
        return t('dashboard.inspect.meta-tab', 'Meta data');
    }
    getTabValue() {
        return InspectTab.Meta;
    }
}
InspectMetaDataTab.Component = ({ model }) => {
    var _a;
    const { panelRef, dataSource } = model.state;
    const data = sceneGraph.getData(panelRef.resolve());
    const Inspector = (_a = dataSource.components) === null || _a === void 0 ? void 0 : _a.MetadataInspector;
    if (!data.state.data || !Inspector) {
        return null;
    }
    return React.createElement(Inspector, { datasource: dataSource, data: data.state.data.series });
};
//# sourceMappingURL=InspectMetaDataTab.js.map