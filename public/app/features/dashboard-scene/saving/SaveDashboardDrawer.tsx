import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef } from '@grafana/scenes';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardAsForm } from './SaveDashboardAsForm';
import { SaveDashboardForm } from './SaveDashboardForm';
import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';

interface SaveDashboardDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  showDiff?: boolean;
  saveTimeRange?: boolean;
  saveVariables?: boolean;
  saveRefresh?: boolean;
  saveAsCopy?: boolean;
  onSaveSuccess?: () => void;
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

  public onToggleSaveRefresh = () => {
    this.setState({ saveRefresh: !this.state.saveRefresh });
  };

  static Component = ({ model }: SceneComponentProps<SaveDashboardDrawer>) => {
    const { showDiff, saveAsCopy, saveTimeRange, saveVariables, saveRefresh } = model.useState();

    const changeInfo = model.state.dashboardRef
      .resolve()
      .getDashboardChanges(saveTimeRange, saveVariables, saveRefresh);

    const { changedSaveModel, initialSaveModel, diffs, diffCount, hasFolderChanges } = changeInfo;
    const changesCount = diffCount + (hasFolderChanges ? 1 : 0);
    const dashboard = model.state.dashboardRef.resolve();
    const { meta } = dashboard.useState();
    const { provisioned: isProvisioned, folderTitle } = meta;

    const tabs = (
      <TabsBar>
        <Tab label={'Details'} active={!showDiff} onChangeTab={() => model.setState({ showDiff: false })} />
        {changesCount > 0 && (
          <Tab
            label={'Changes'}
            active={showDiff}
            onChangeTab={() => model.setState({ showDiff: true })}
            counter={changesCount}
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
        return (
          <SaveDashboardDiff
            diff={diffs}
            oldValue={initialSaveModel}
            newValue={changedSaveModel}
            hasFolderChanges={hasFolderChanges}
            oldFolder={dashboard.getInitialState()?.meta.folderTitle}
            newFolder={folderTitle}
          />
        );
      }

      if (saveAsCopy || changeInfo.isNew) {
        return <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} />;
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
