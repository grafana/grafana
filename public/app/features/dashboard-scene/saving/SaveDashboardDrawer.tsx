import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef } from '@grafana/scenes';
import { Drawer, Tab, TabsBar } from '@grafana/ui';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { SaveProvisionedDashboard } from 'app/features/provisioning/components/Dashboards/SaveProvisionedDashboard';
import { useIsProvisionedNG } from 'app/features/provisioning/hooks/useIsProvisionedNG';

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
  showVariablesWarning?: boolean;
  onSaveSuccess?: () => void;
}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  public onClose = () => {
    const dashboard = this.state.dashboardRef.resolve();
    const changeInfo = dashboard.getDashboardChanges();
    dashboard.setState({
      overlay: undefined,
      // Reset meta to initial state if it's a new dashboard to remove provisioned fields
      meta: changeInfo.isNew ? dashboard.getInitialState()?.meta : dashboard.state.meta,
    });
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

  static Component = SaveDashboardDrawerComponent;
}

function SaveDashboardDrawerComponent({ model }: SceneComponentProps<SaveDashboardDrawer>) {
  const { showDiff, saveAsCopy, saveTimeRange, saveVariables, saveRefresh } = model.useState();

  const changeInfo = model.state.dashboardRef.resolve().getDashboardChanges(saveTimeRange, saveVariables, saveRefresh);

  const { changedSaveModel, initialSaveModel, diffs, diffCount, hasFolderChanges, hasMigratedToV2 } = changeInfo;
  const changesCount = diffCount + (hasFolderChanges ? 1 : 0);
  const dashboard = model.state.dashboardRef.resolve();
  const { meta } = dashboard.useState();
  const { provisioned: isProvisioned, folderTitle } = meta;
  const managedResourceCannotBeEdited = dashboard.managedResourceCannotBeEdited();
  const isProvisionedNG = useIsProvisionedNG(dashboard);

  const tabs = (
    <TabsBar>
      <Tab
        label={t('dashboard-scene.save-dashboard-drawer.tabs.label-details', 'Details')}
        active={!showDiff}
        onChangeTab={() => model.setState({ showDiff: false })}
      />
      {changesCount > 0 && !managedResourceCannotBeEdited && (
        <Tab
          label={t('dashboard-scene.save-dashboard-drawer.tabs.label-changes', 'Changes')}
          active={showDiff}
          onChangeTab={() => model.setState({ showDiff: true })}
          counter={changesCount}
        />
      )}
    </TabsBar>
  );

  let title = t('dashboard-scene.save-dashboard-drawer.tabs.title', 'Save dashboard');
  if (saveAsCopy) {
    title = t('dashboard-scene.save-dashboard-drawer.tabs.title-copy', 'Save dashboard copy');
  } else if (isProvisioned || isProvisionedNG) {
    title = t('dashboard-scene.save-dashboard-drawer.tabs.title-provisioned', 'Provisioned dashboard');
  }

  const renderBody = () => {
    if (showDiff) {
      return (
        <SaveDashboardDiff
          diff={diffs}
          oldValue={initialSaveModel}
          newValue={changedSaveModel}
          hasFolderChanges={hasFolderChanges}
          hasMigratedToV2={hasMigratedToV2}
          oldFolder={dashboard.getInitialState()?.meta.folderTitle}
          newFolder={folderTitle}
        />
      );
    }

    if (isProvisionedNG) {
      return <SaveProvisionedDashboard dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
    }

    if (saveAsCopy || changeInfo.isNew) {
      return <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} />;
    }

    if (isProvisioned || managedResourceCannotBeEdited) {
      return <SaveProvisionedDashboardForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
    }

    return <SaveDashboardForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
  };

  return (
    <Drawer title={title} subtitle={dashboard.state.title} onClose={model.onClose} tabs={tabs}>
      {renderBody()}
    </Drawer>
  );
}
