import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectState, type SceneObjectRef } from '@grafana/scenes';
import { Drawer, Spinner, Stack, Tab, TabsBar } from '@grafana/ui';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { FolderDeadEndAlert } from 'app/features/provisioning/components/Dashboards/FolderDeadEndAlert';
import { SaveProvisionedDashboard } from 'app/features/provisioning/components/Dashboards/SaveProvisionedDashboard';
import { SaveTargetSwitch } from 'app/features/provisioning/components/Shared/SaveTargetSwitch';
import { useDashboardRepositoryView } from 'app/features/provisioning/hooks/useDashboardRepositoryView';
import { RepoViewStatus } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { getSaveTarget, type SaveTarget } from 'app/features/provisioning/hooks/useSaveRepositoryView';
import { type RecoverToNewBranch } from 'app/features/provisioning/types';

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
import { isNewDashboard } from './shared';

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
  recoverToNewBranch?: RecoverToNewBranch;
  /** Where a new save at the root of a folderless repository goes; unset means wherever the lookup says */
  saveTarget?: SaveTarget;
}

/** Title and description a save form shows, so a form swap can hand them to the next one */
export interface SaveFormDraft {
  title?: string;
  description?: string;
}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  /**
   * Title/description a save form shows, parked by useParkSaveFormDraft as they change and read once by
   * the form that replaces it after a folder pick or target switch. Not scene state: it changes per
   * keystroke, and reactivity would re-render the drawer (and re-diff the dashboard) each time.
   */
  public saveFormDraft: SaveFormDraft | undefined;

  public onClose = () => {
    const dashboard = this.state.dashboardRef.resolve();
    // Save As folder picker mutates live meta; restore on cancel so the source dash isn't left dirty.
    const shouldRestoreMeta = Boolean(this.state.saveAsCopy) || isNewDashboard(dashboard.state);
    dashboard.closeModal();
    dashboard.setState({
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
    recoverToNewBranch,
    saveTarget,
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
  const view = useDashboardRepositoryView(dashboard, saveAsCopy);
  const { isNewSave } = view;
  const target = getSaveTarget(view, saveTarget);

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
  } else if (!isNewSave && (isProvisioned || view.isProvisioned)) {
    title = t('dashboard-scene.save-dashboard-drawer.tabs.title-provisioned', 'Provisioned dashboard');
  }

  const initialAnnotation = dashboard.getInitialState()?.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables];
  const currentAnnotation = getPredefinedVariablesAnnotation(dashboard);

  const renderForm = () => {
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

    if (target === 'repository') {
      return (
        <SaveProvisionedDashboard
          dashboard={dashboard}
          changeInfo={changeInfo}
          drawer={model}
          saveAsCopy={saveAsCopy}
          recoverToNewBranch={recoverToNewBranch}
          view={view}
        />
      );
    }

    // First lookup of a new save: nothing settled to hold, so the form waits
    if (view.status === RepoViewStatus.Loading) {
      return <Spinner />;
    }

    if (isNewSave) {
      return <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} isHeld={view.isHeld} />;
    }

    if (isProvisioned || managedResourceCannotBeEdited) {
      return <SaveProvisionedDashboardForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
    }

    return <SaveDashboardForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
  };

  return (
    <Drawer title={title} subtitle={dashboard.state.title} onClose={model.onClose} tabs={tabs}>
      {/* The form stays mounted (hidden) while the Changes tab is open so its field state survives tab switches */}
      <div style={{ display: showDiff ? 'none' : 'contents' }}>
        <Stack direction="column" gap={2}>
          {isNewSave && <FolderDeadEndAlert {...view.lookup} />}
          {renderForm()}
          {view.canChooseTarget && (
            <SaveTargetSwitch
              resource="dashboard"
              target={target}
              onChange={(saveTarget) => model.setState({ saveTarget })}
            />
          )}
        </Stack>
      </div>
      {showDiff && (
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
      )}
    </Drawer>
  );
}
