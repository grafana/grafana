import React, { useState } from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef } from '@grafana/scenes';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { SaveDashboardOptions } from 'app/features/dashboard/components/SaveDashboard/types';

import { DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { jsonDiff } from '../settings/version-history/utils';

import { SaveDashboardForm } from './SaveDashboardForm';

interface SaveDashboardDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  onClose = () => {
    this.state.dashboardRef.resolve().setState({ overlay: undefined });
  };

  static Component = ({ model }: SceneComponentProps<SaveDashboardDrawer>) => {
    const dashboard = model.state.dashboardRef.resolve();
    const initialState = dashboard.getInitialState();
    const initialScene = new DashboardScene(initialState!);
    const initialSaveModel = transformSceneToSaveModel(initialScene);
    const changedSaveModel = transformSceneToSaveModel(dashboard);

    const [showDiff, setShowDiff] = useState(false);
    const [options, setOptions] = useState<SaveDashboardOptions>({
      folderUid: dashboard.state.meta.folderUid,
    });

    const diff = jsonDiff(initialSaveModel, changedSaveModel);

    let diffCount = 0;
    for (const d of Object.values(diff)) {
      diffCount += d.length;
    }

    const tabs = (
      <TabsBar>
        <Tab label={'Details'} active={!showDiff} onChangeTab={() => setShowDiff(false)} />
        {diffCount > 0 && (
          <Tab label={'Changes'} active={showDiff} onChangeTab={() => setShowDiff(true)} counter={diffCount} />
        )}
      </TabsBar>
    );

    return (
      <Drawer title="Save dashboard" subtitle={dashboard.state.title} onClose={model.onClose} tabs={tabs}>
        {showDiff && <SaveDashboardDiff diff={diff} oldValue={initialSaveModel} newValue={changedSaveModel} />}
        {!showDiff && (
          <SaveDashboardForm
            dashboard={dashboard}
            saveModel={changedSaveModel}
            hasChanges={diffCount > 0}
            options={options}
            onOptionsChange={setOptions}
          />
        )}
      </Drawer>
    );
  };
}
