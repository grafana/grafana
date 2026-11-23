import { type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectState, type SceneObjectRef } from '@grafana/scenes';
import { Box, Drawer, EmptyState, ScrollContainer, Stack, Tab, TabsBar } from '@grafana/ui';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';
import { SaveDashboardDiff } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDiff';
import { useDashboardSaveSlot } from 'app/features/provisioning/components/Dashboards/useDashboardSaveSlot';
import { type SaveTarget } from 'app/features/provisioning/hooks/useSaveRepositoryView';
import { type RecoverToNewBranch } from 'app/features/provisioning/types';

import { SavePendingChangesForm } from '../lifecycle/SavePendingChangesForm';
import { savesPendingChanges } from '../lifecycle/pendingChangesSave';
import { type DashboardScene } from '../scene/DashboardScene';
import {
  formatPredefinedVariablesAnnotationLabel,
  getPredefinedVariablesAnnotation,
} from '../utils/predefinedVariablesMetadata';

import { SaveDashboardAsForm } from './SaveDashboardAsForm';
import { SaveDashboardForm } from './SaveDashboardForm';
import { getSaveAsTemplateForm } from './enterprise-components/SaveAsTemplateFormExtension';
import { getSaveDashboardTemplateForm } from './enterprise-components/SaveDashboardTemplateFormExtension';
import { isNewDashboard } from './shared';
import { useDashboardSaveChanges } from './useDashboardSaveChanges';

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
  onDismiss?: () => void;
  recoverToNewBranch?: RecoverToNewBranch;
  /** Where a new save at the root of a folderless repository goes; unset means wherever the lookup says */
  saveTarget?: SaveTarget;
  /** Set once a save lands and reports itself in place; the drawer shows it instead of a form. */
  saveReport?: SaveReport;
}

/**
 * A completed save, reported inside the drawer by whichever form made it rather than by navigating
 * away. The form owns the content, so the drawer needs to know nothing about what was saved or where
 * it went — only that a report is showing, which is what retires its form and its diff.
 */
export interface SaveReport {
  content: ReactNode;
  /**
   * A page transition the save still owes, run once the drawer closes. A transition made any earlier
   * would reload the page and take the report with it.
   */
  afterClose?: () => Promise<void>;
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
    // A reported save has already been adopted by the scene; the pre-save meta would undo it.
    const shouldRestoreMeta =
      !this.state.saveReport && (Boolean(this.state.saveAsCopy) || isNewDashboard(dashboard.state));
    dashboard.setState({
      meta: shouldRestoreMeta ? (dashboard.getInitialState()?.meta ?? dashboard.state.meta) : dashboard.state.meta,
    });
    dashboard.closeModal();
    this.state.onDismiss?.();
    const { afterClose } = this.state.saveReport ?? {};
    this.setState({ saveReport: undefined });
    afterClose?.();
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
    saveReport,
  } = model.useState();

  const changeInfo = useDashboardSaveChanges(
    model.state.dashboardRef.resolve(),
    saveTimeRange,
    saveVariables,
    saveRefresh
  );

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
  const { folderTitle } = dashboard.useState().meta;
  // Everything a repository decides about this save, resolved in one place.
  const slot = useDashboardSaveSlot({
    dashboard,
    drawer: model,
    changeInfo,
    saveAsCopy,
    recoverToNewBranch,
    saveTarget,
  });

  const tabs = (
    <TabsBar>
      <Tab
        label={t('dashboard-scene.save-dashboard-drawer.tabs.label-details', 'Details')}
        active={!showDiff}
        onChangeTab={() => model.setState({ showDiff: false })}
      />
      {(changesCount > 0 || showDiff) && !slot.hidesDiff && !saveReport && (
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
  } else if (slot.title) {
    title = slot.title;
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

    // Pending changes are saved through the plugin that keeps them, unless a repository keeps the
    // dashboard: they are committed to it then, as any other change is. A copy of them is a new dashboard.
    if (!saveAsCopy && !slot.takesSave && savesPendingChanges(dashboard)) {
      return <SavePendingChangesForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
    }

    // A reported save is rendered from what the form captured as it landed. Nothing may re-resolve
    // here: the save moved the ground underneath `target`, since a created dashboard is no longer a
    // new save and a branch commit is not in Grafana at all, so the lookup comes back empty.
    if (saveReport) {
      return saveReport.content;
    }

    if (slot.form) {
      return slot.form;
    }

    if (slot.isNewSave) {
      return <SaveDashboardAsForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} isHeld={slot.isHeld} />;
    }

    return slot.readOnlyNotice ?? <SaveDashboardForm dashboard={dashboard} changeInfo={changeInfo} drawer={model} />;
  };

  return (
    <Drawer
      title={title}
      subtitle={dashboard.state.title}
      onClose={model.onClose}
      tabs={tabs}
      scrollableContent={false}
    >
      {/* The form stays mounted (hidden) while the Changes tab is open so its field state survives tab switches */}
      <Box display={showDiff ? 'none' : 'flex'} direction="column" height="100%">
        <ScrollContainer showScrollIndicators>
          <Box padding={0.5}>
            <Stack direction="column" gap={2}>
              {slot.alert}
              {renderForm()}
            </Stack>
          </Box>
        </ScrollContainer>
      </Box>
      {showDiff && changesCount === 0 && (
        <EmptyState variant="completed" message={t('dashboard.review.no-changes', 'No changes to save')} />
      )}
      {showDiff && changesCount > 0 && (
        <SaveDashboardDiff
          fillHeight
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
