import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef } from '@grafana/scenes';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardAsForm } from './SaveDashboardAsForm';
import { SaveDashboardForm } from './SaveDashboardForm';
import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';
import { getDashboardChangesFromScene } from './getDashboardChangesFromScene';

interface SaveDashboardDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  showDiff?: boolean;
  saveTimeRange?: boolean;
  saveVariables?: boolean;
  saveAsCopy?: boolean;
}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  public onClose = () => {
    this.state.dashboardRef.resolve().setState({ overlay: undefined });
  };

  public onToggleSaveTimeRange = () => {
    this.setState({ saveTimeRange: !this.state.saveTimeRange });
  };

  public onToggleSaveVariables = () => {
    this.setState({ saveVariables: !this.state.saveVariables });
  };

  static Component = ({ model }: SceneComponentProps<SaveDashboardDrawer>) => {
    const { showDiff, saveAsCopy, saveTimeRange, saveVariables } = model.useState();
    const changeInfo = getDashboardChangesFromScene(model.state.dashboardRef.resolve(), saveTimeRange, saveVariables);
    const { changedSaveModel, initialSaveModel, diffs, diffCount } = changeInfo;
    const dashboard = model.state.dashboardRef.resolve();
    const isProvisioned = dashboard.state.meta.provisioned;

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

    let title = 'Save dashboard';
    if (saveAsCopy) {
      title = 'Save dashboard copy';
    } else if (isProvisioned) {
      title = 'Provisioned dashboard';
    }

    const renderBody = () => {
      if (showDiff) {
        return <SaveDashboardDiff diff={diffs} oldValue={initialSaveModel} newValue={changedSaveModel} />;
      }

      if (saveAsCopy || changeInfo.isNew) {
        return <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
      }

      if (isProvisioned) {
        return <SaveProvisionedDashboardForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
      }

      return <SaveDashboardForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
    };

    return (
      <Drawer title={title} subtitle={dashboard.state.title} onClose={model.onClose} tabs={tabs}>
        {renderBody()}
      </Drawer>
    );
  };
}
