import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';

import { DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { jsonDiff } from '../settings/version-history/utils';

import { SaveDashboardForm } from './SaveDashboardForm';
import { DashboardChangeInfo } from './types';

interface SaveDashboardDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  showDiff?: boolean;
  saveTimeRange?: boolean;
  saveVariables?: boolean;
}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  public onClose = () => {
    this.state.dashboardRef.resolve().setState({ overlay: undefined });
  };

  public onToggleSaveTimeRange = () => {
    this.setState({ saveTimeRange: !this.state.saveTimeRange });
  };

  public onToggleSaveVariables = () => {
    this.setState({ saveTimeRange: !this.state.saveTimeRange });
  };

  public getSaveDashboardChange(): DashboardChangeInfo {
    const dashboard = this.state.dashboardRef.resolve();

    const initialState = dashboard.getInitialState();
    const initialScene = new DashboardScene(initialState!);
    const initialSaveModel = transformSceneToSaveModel(initialScene);
    const changedSaveModel = transformSceneToSaveModel(dashboard);
    const hasTimeChanged = getHasTimeChanged(changedSaveModel, initialSaveModel);
    const hasVariableValuesChanged = getVariableValueChanges(changedSaveModel, initialSaveModel);

    if (!this.state.saveTimeRange) {
      changedSaveModel.time = initialSaveModel.time;
    }

    const diff = jsonDiff(initialSaveModel, changedSaveModel);

    let diffCount = 0;
    for (const d of Object.values(diff)) {
      diffCount += d.length;
    }

    return {
      changedSaveModel,
      initialSaveModel,
      diffs: diff,
      diffCount,
      hasChanges: diffCount > 0,
      hasTimeChanged,
      hasVariableValuesChanged,
    };
  }

  static Component = ({ model }: SceneComponentProps<SaveDashboardDrawer>) => {
    const { showDiff } = model.useState();
    const changeInfo = model.getSaveDashboardChange();
    const { changedSaveModel, initialSaveModel, diffs, diffCount } = changeInfo;
    const dashboard = model.state.dashboardRef.resolve();

    const tabs = (
      <TabsBar>
        <Tab label={'Details'} active={!showDiff} onChangeTab={() => model.setState({ showDiff: false })} />
        {diffCount > 0 && (
          <Tab
            label={'Changes'}
            active={showDiff}
            onChangeTab={() => model.setState({ showDiff: true })}
            counter={diffCount}
          />
        )}
      </TabsBar>
    );

    return (
      <Drawer title="Save dashboard" subtitle={dashboard.state.title} onClose={model.onClose} tabs={tabs}>
        {showDiff && <SaveDashboardDiff diff={diffs} oldValue={initialSaveModel} newValue={changedSaveModel} />}
        {!showDiff && <SaveDashboardForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />}
      </Drawer>
    );
  };
}

function getHasTimeChanged(saveModel: Dashboard, originalSaveModel: Dashboard) {
  return saveModel.time?.from !== originalSaveModel.time?.from || saveModel.time?.to !== originalSaveModel.time?.to;
}

function getVariableValueChanges(saveModel: Dashboard, originalSaveModel: Dashboard) {
  return true;
}
