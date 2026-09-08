import { useRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectState, type SceneObjectRef } from '@grafana/scenes';
import { Alert, Button, Drawer, Spinner, Stack, Tab, TabsBar } from '@grafana/ui';
import { AnnoKeyIgnorePredefinedVariables } from 'app/features/apiserver/types';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { FormLoadingErrorAlert } from 'app/features/provisioning/components/Dashboards/FormLoadingErrorAlert';
import { SaveProvisionedDashboard } from 'app/features/provisioning/components/Dashboards/SaveProvisionedDashboard';
import {
  type DashboardRepositoryView,
  useDashboardRepositoryView,
} from 'app/features/provisioning/hooks/useDashboardRepositoryView';
import { RepoViewStatus } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

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

type SaveTarget = 'repository' | 'database';

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
  /** Where a new save at the root of a folderless repository goes; unset means wherever the lookup says */
  saveTarget?: SaveTarget;
}

/** Title and description typed into a save form, so a form swap can hand them to the next one */
export interface SaveFormDraft {
  title?: string;
  description?: string;
}

export class SaveDashboardDrawer extends SceneObjectBase<SaveDashboardDrawerState> {
  /**
   * Title/description typed into a save form, read once by the form that replaces it after a folder
   * pick or target switch. Not scene state: it is written on every keystroke and read only on mount,
   * so reactivity would just re-render the drawer (and re-diff the dashboard) per keystroke.
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
  const liveView = useDashboardRepositoryView(dashboard, saveAsCopy);
  const { isNewSave } = liveView;
  // A folder pick re-runs the lookup. Hold the last settled view while it is in flight, and through a
  // dead end (the picked folder's repository is gone, or its lookup failed): unmounting the form that is
  // up would drop what the user typed, and its folder picker is the only way out of the dead end
  const isDeadEnd =
    isNewSave && (liveView.status === RepoViewStatus.Orphaned || liveView.status === RepoViewStatus.Error);
  const settledView = useRef<DashboardRepositoryView | undefined>(undefined);
  if (!liveView.isLoading && !(isDeadEnd && settledView.current)) {
    settledView.current = liveView;
  }
  const view = settledView.current ?? liveView;
  const isHolding = view !== liveView;
  // The root of a folderless repository is the one place a new save can go either way
  const canChooseTarget = isNewSave && !meta.folderUid && view.repository?.target === 'folderless';
  const target: SaveTarget =
    canChooseTarget && saveTarget ? saveTarget : view.isProvisioned ? 'repository' : 'database';

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

  const initialAnnotation = dashboard.getInitialState()?.meta.k8s?.annotations?.[AnnoKeyIgnorePredefinedVariables];
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
          view={view}
          isReresolving={isHolding}
        />
      );
    }

    // First lookup of a new save: nothing settled to hold, so the form waits
    if (view.isLoading) {
      return <Spinner />;
    }

    if (saveAsCopy || changeInfo.isNew) {
      return <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
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
          {isDeadEnd &&
            isHolding &&
            (liveView.status === RepoViewStatus.Orphaned ? (
              <Alert
                severity="warning"
                title={t(
                  'dashboard-scene.save-dashboard-drawer.folder-repo-missing-title',
                  'The selected folder cannot be saved to'
                )}
              >
                <Trans i18nKey="dashboard-scene.save-dashboard-drawer.folder-repo-missing-body">
                  The provisioning repository managing this folder no longer exists. Choose a different folder or save
                  at the repository root.
                </Trans>
              </Alert>
            ) : (
              <FormLoadingErrorAlert error={liveView.error} />
            ))}
          {renderForm()}
          {canChooseTarget && (
            <div>
              <Button
                variant="secondary"
                size="sm"
                fill="text"
                onClick={() => model.setState({ saveTarget: target === 'repository' ? 'database' : 'repository' })}
              >
                {target === 'repository' ? (
                  <Trans i18nKey="dashboard-scene.save-dashboard-drawer.save-to-database">
                    Save to Grafana database instead
                  </Trans>
                ) : (
                  <Trans i18nKey="dashboard-scene.save-dashboard-drawer.save-to-git">
                    Save to Git repository instead
                  </Trans>
                )}
              </Button>
            </div>
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
