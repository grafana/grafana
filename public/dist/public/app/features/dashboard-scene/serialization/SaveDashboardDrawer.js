import React from 'react';
import { SceneObjectBase } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { jsonDiff } from 'app/features/dashboard/components/VersionHistory/utils';
import { DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from './transformSceneToSaveModel';
export class SaveDashboardDrawer extends SceneObjectBase {
    constructor() {
        super(...arguments);
        this.onClose = () => {
            this.state.dashboardRef.resolve().setState({ overlay: undefined });
        };
    }
}
SaveDashboardDrawer.Component = ({ model }) => {
    const dashboard = model.state.dashboardRef.resolve();
    const initialState = dashboard.getInitialState();
    const initialScene = new DashboardScene(initialState);
    const initialSaveModel = transformSceneToSaveModel(initialScene);
    const changedSaveModel = transformSceneToSaveModel(dashboard);
    const diff = jsonDiff(initialSaveModel, changedSaveModel);
    // let diffCount = 0;
    // for (const d of Object.values(diff)) {
    //   diffCount += d.length;
    // }
    return (React.createElement(Drawer, { title: "Save dashboard", subtitle: dashboard.state.title, onClose: model.onClose },
        React.createElement(SaveDashboardDiff, { diff: diff, oldValue: initialSaveModel, newValue: changedSaveModel })));
};
//# sourceMappingURL=SaveDashboardDrawer.js.map