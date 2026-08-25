import { useRef } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectState, type SceneObjectRef } from '@grafana/scenes';
import { Drawer, Spinner, Tab, TabsBar } from '@grafana/ui';
import { AnnoKeyIgnorePredefinedVariables } from 'app/features/apiserver/types';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { SaveProvisionedDashboard } from 'app/features/provisioning/components/Dashboards/SaveProvisionedDashboard';
import { useIsProvisionedNG } from 'app/features/provisioning/hooks/useIsProvisionedNG';
import { type DashboardMeta } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';
import {
  formatPredefinedVariablesAnnotationLabel,
  getPredefinedVariablesAnnotation,
} from '../utils/predefinedVariablesMetadata';

import { SaveDashboardAsForm } from './SaveDashboardAsForm';
import { SaveDashboardForm } from './SaveDashboardForm';
import { SaveProvisionedDashboardForm } from './SaveProvisionedDashboardForm';
import { getSaveAsTemplateForm } from './enterprise-components/SaveAsTemplateFormExtension';
import { getSaveDashboardTemplateForm } from './enterprise-components/SaveDashboardTemplateFormExtension';

interface SaveDashboardDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  showDiff?: boolean;
  saveTimeRange?: boolean;
  saveVariables?: boolean;
  saveRefresh?: boolean;
  saveAsCopy?: boolean;
  saveAsDashboardTemplate?: boolean;
  saveDashboardTemplate?: boolean;
  showVariablesWarning?: boolean;
  onSaveSuccess?: () => void;
  // Git/Database switch for provisioned saves, owned by useDatabaseSaveSwitch. Lives on the
  // drawer because switching tabs unmounts the save form while the drawer stays open.
  saveToDatabase?: boolean;
  // uid is the scene uid at switch time; a different one on unmount means a save already landed
  databaseSwitchSnapshot?: { gitMeta: DashboardMeta; wasNew: boolean; uid?: string };
}

/** Title and description typed into a save form, so a form swap can hand them to the next one */
export interface SaveFormDraft {
  title?: string;
  description?: string;
}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  /**
   * Deliberately not scene state: a folder pick can change which save form applies, and each form
   * keeps title/description in its own local form state, so the draft outlives the swap here. It is
   * only read when a form mounts and written when one unmounts, so making it reactive would just
   * re-render the drawer on every swap.
   */
  public saveFormDraft: SaveFormDraft | undefined;

  public onClose = () => {
    const dashboard = this.state.dashboardRef.resolve();
    const changeInfo = dashboard.getDashboardChanges();
    // Save As folder picker mutates live meta; restore on cancel so the source dash isn't left dirty.
    const shouldRestoreMeta = changeInfo.isNew || Boolean(this.state.saveAsCopy);
    dashboard.setState({
      overlay: undefined,
      meta: shouldRestoreMeta ? (dashboard.getInitialState()?.meta ?? dashboard.state.meta) : dashboard.state.meta,
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
  const {
    showDiff,
    saveAsCopy,
    saveAsDashboardTemplate,
    saveDashboardTemplate,
    saveTimeRange,
    saveVariables,
    saveRefresh,
    saveToDatabase,
  } = model.useState();

  const changeInfo = model.state.dashboardRef.resolve().getDashboardChanges(saveTimeRange, saveVariables, saveRefresh);

  const {
    changedSaveModel,
    initialSaveModel,
    diffs,
    diffCount,
    hasFolderChanges,
    hasPredefinedVariablesChanges,
    hasMigratedToV2,
  } = changeInfo;
  const changesCount = diffCount + (hasFolderChanges ? 1 : 0) + (hasPredefinedVariablesChanges ? 1 : 0);
  const dashboard = model.state.dashboardRef.resolve();
  const { meta } = dashboard.useState();
  const { provisioned: isProvisioned, folderTitle } = meta;
  const managedResourceCannotBeEdited = dashboard.managedResourceCannotBeEdited();
  const { isProvisioned: resolvedIsProvisionedNG, isLoading: isResolvingRepo } = useIsProvisionedNG(
    dashboard,
    saveAsCopy
  );
  // A folder pick re-runs the repository lookup, so hold the last settled answer while the next one
  // is in flight: unmounting the form that is already up would drop what the user typed into it
  const settledIsProvisionedNG = useRef<boolean | undefined>(undefined);
  if (!isResolvingRepo) {
    settledIsProvisionedNG.current = resolvedIsProvisionedNG;
  }
  const isProvisionedNG = settledIsProvisionedNG.current ?? resolvedIsProvisionedNG;
  // Only the first lookup has nothing to hold, so it is the only one that may show a spinner
  const isFirstRepoResolve = isResolvingRepo && settledIsProvisionedNG.current === undefined;

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
  if (saveAsDashboardTemplate) {
    title = t('dashboard-scene.save-dashboard-drawer.tabs.title-template', 'Save as template');
  } else if (saveDashboardTemplate) {
    title = t('dashboard-scene.save-dashboard-drawer.tabs.title-update-template', 'Save template');
  } else if (saveAsCopy) {
    title = t('dashboard-scene.save-dashboard-drawer.tabs.title-copy', 'Save dashboard copy');
  } else if ((isProvisioned || isProvisionedNG) && !changeInfo.isNew && !saveToDatabase) {
    // A dashboard that does not exist yet, or one being written to the database, is not provisioned
    title = t('dashboard-scene.save-dashboard-drawer.tabs.title-provisioned', 'Provisioned dashboard');
  }

  const renderBody = () => {
    if (showDiff) {
      const initialAnnotation = dashboard.getInitialState()?.meta.k8s?.annotations?.[AnnoKeyIgnorePredefinedVariables];
      const currentAnnotation = getPredefinedVariablesAnnotation(dashboard);
      return (
        <SaveDashboardDiff
          diff={diffs}
          oldValue={initialSaveModel}
          newValue={changedSaveModel}
          hasFolderChanges={hasFolderChanges}
          hasPredefinedVariablesChanges={hasPredefinedVariablesChanges}
          hasMigratedToV2={hasMigratedToV2}
          oldFolder={dashboard.getInitialState()?.meta.folderTitle}
          newFolder={folderTitle}
          oldPredefinedVariables={formatPredefinedVariablesAnnotationLabel(
            typeof initialAnnotation === 'string' ? initialAnnotation : undefined
          )}
          newPredefinedVariables={formatPredefinedVariablesAnnotationLabel(currentAnnotation)}
        />
      );
    }

    if (saveDashboardTemplate) {
      const SaveDashboardTemplateForm = getSaveDashboardTemplateForm();
      if (SaveDashboardTemplateForm) {
        return <SaveDashboardTemplateForm dashboard={dashboard} drawer={model} changeInfo={changeInfo} />;
      }
    }

    if (saveAsDashboardTemplate) {
      const SaveAsTemplateForm = getSaveAsTemplateForm();
      if (SaveAsTemplateForm) {
        return <SaveAsTemplateForm dashboard={dashboard} />;
      }
    }

    // Checked before the spinner: once switched to the database form, a folder pick re-runs the
    // repository lookup, and neither a cold cache nor an unmanaged folder may unmount that form
    if (saveToDatabase || isProvisionedNG) {
      return (
        <SaveProvisionedDashboard
          dashboard={dashboard}
          changeInfo={changeInfo}
          drawer={model}
          saveAsCopy={saveAsCopy}
        />
      );
    }

    if (isFirstRepoResolve) {
      return <Spinner />;
    }

    if (saveAsCopy || changeInfo.isNew) {
      return (
        <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} onCancel={model.onClose} drawer={model} />
      );
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
