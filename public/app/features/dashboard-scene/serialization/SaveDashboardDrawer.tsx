import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { jsonDiff } from 'app/features/dashboard/components/VersionHistory/utils';

import { DashboardScene } from '../scene/DashboardScene';

import { transformSceneToSaveModel } from './transformSceneToSaveModel';

interface SaveDashboardDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  onClose = () => {
    this.state.dashboardRef.resolve().setState({ drawer: undefined });
  };

  static Component = ({ model }: SceneComponentProps<SaveDashboardDrawer>) => {
    const dashboard = model.state.dashboardRef.resolve();
    const initialState = dashboard.getInitialState();
    const initialScene = new DashboardScene(initialState!);
    const initialSaveModel = transformSceneToSaveModel(initialScene);
    const changedSaveModel = transformSceneToSaveModel(dashboard);

    const diff = jsonDiff(initialSaveModel, changedSaveModel);

    // let diffCount = 0;
    // for (const d of Object.values(diff)) {
    //   diffCount += d.length;
    // }

    return (
      <Drawer title="Save dashboard" subtitle={dashboard.state.title} scrollableContent onClose={model.onClose}>
        <SaveDashboardDiff diff={diff} oldValue={initialSaveModel} newValue={changedSaveModel} />
      </Drawer>
    );
  };
}
