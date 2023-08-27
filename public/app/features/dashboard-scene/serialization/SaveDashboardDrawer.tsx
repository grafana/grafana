import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { jsonDiff } from 'app/features/dashboard/components/VersionHistory/utils';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardChangeTracker } from './DashboardChangeTracker';
import { transformSceneToSaveModel } from './transformSceneToSaveModel';

interface SaveDashboardDrawerState extends SceneObjectState {}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  constructor(
    public dashboard: DashboardScene,
    public changeTracker: DashboardChangeTracker
  ) {
    super({});
  }

  onClose = () => {
    this.dashboard.setState({ drawer: undefined });
  };

  static Component = ({ model }: SceneComponentProps<SaveDashboardDrawer>) => {
    const originalVersion = transformSceneToSaveModel(model.changeTracker.getOriginal());
    const saveVersion = transformSceneToSaveModel(model.dashboard);

    const diff = jsonDiff(originalVersion, saveVersion);

    let diffCount = 0;
    for (const d of Object.values(diff)) {
      diffCount += d.length;
    }

    return (
      <Drawer title="Save dashboard" subtitle={model.dashboard.state.title} scrollableContent onClose={model.onClose}>
        <SaveDashboardDiff diff={diff} oldValue={originalVersion} newValue={saveVersion} />
      </Drawer>
    );
  };
}
