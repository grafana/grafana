import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { jsonDiff } from 'app/features/dashboard/components/VersionHistory/utils';

import { DashboardScene } from '../scene/DashboardScene';

import { transformSceneToSaveModel } from './transformSceneToSaveModel';

interface SaveDashboardDrawerState extends SceneObjectState {}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  constructor(public dashboard: DashboardScene) {
    super({});
  }

  onClose = () => {
    this.dashboard.setState({ drawer: undefined });
  };

  static Component = ({ model }: SceneComponentProps<SaveDashboardDrawer>) => {
    const initialScene = new DashboardScene(model.dashboard.getInitialState()!);
    const initialSaveModel = transformSceneToSaveModel(initialScene);
    const changedSaveModel = transformSceneToSaveModel(model.dashboard);

    const diff = jsonDiff(initialSaveModel, changedSaveModel);

    // let diffCount = 0;
    // for (const d of Object.values(diff)) {
    //   diffCount += d.length;
    // }

    return (
      <Drawer title="Save dashboard" subtitle={model.dashboard.state.title} scrollableContent onClose={model.onClose}>
        <SaveDashboardDiff diff={diff} oldValue={initialSaveModel} newValue={changedSaveModel} />
      </Drawer>
    );
  };
}
