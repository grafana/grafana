import { css } from '@emotion/css';
import type * as H from 'history';
import { memo, useContext, useEffect, useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { ModalsContext, Modal, Button, useStyles2 } from '@grafana/ui';
import { Prompt } from 'app/core/components/FormPrompt/Prompt';
import { contextSrv } from 'app/core/services/context_srv';
import { type ObjectMeta } from 'app/features/apiserver/types';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { DASHBOARD_LIBRARY_ROUTES } from 'app/features/dashboard/dashgrid/types';
import { type DashboardMeta } from 'app/types/dashboard';

import { getPendingChangesHistory } from '../lifecycle/pendingChangePreview';
import { hasUnrecordedPendingChange, recordPendingChange } from '../lifecycle/pendingChangesHistory';
import { SaveLibraryVizPanelModal } from '../panel-edit/SaveLibraryVizPanelModal';
import { type DashboardScene } from '../scene/DashboardScene';
import { getLibraryPanelBehavior, hasActualSaveChanges, isLibraryPanel } from '../utils/utils';

interface DashboardPromptProps {
  dashboard: DashboardScene;
}

export const DashboardPrompt = memo(({ dashboard }: DashboardPromptProps) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const originalLocation = useMemo(() => locationService.getLocation(), [dashboard]);
  const originalPath = useMemo(() => originalLocation.pathname, [originalLocation]);
  const { showModal, hideModal } = useContext(ModalsContext);

  useEffect(() => {
    const handleUnload = (event: BeforeUnloadEvent) => {
      if (ignoreChanges(dashboard)) {
        return;
      }

      if (hasChangesToLose(dashboard)) {
        event.preventDefault();
        // No browser actually displays this message anymore.
        // But Chrome requires it to be defined else the popup won't show.
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [dashboard]);

  const onHistoryBlock = (location: H.Location) => {
    const panelEditor = dashboard.state.editPanel;
    const vizPanel = panelEditor?.getPanel();
    const search = new URLSearchParams(location.search);

    // Are we leaving panel edit & library panel?
    if (panelEditor && vizPanel && isLibraryPanel(vizPanel) && panelEditor.state.isDirty && !search.has('editPanel')) {
      const libPanelBehavior = getLibraryPanelBehavior(vizPanel);

      showModal(SaveLibraryVizPanelModal, {
        dashboard,
        isUnsavedPrompt: true,
        libraryPanel: libPanelBehavior!,
        onConfirm: () => {
          panelEditor.onConfirmSaveLibraryPanel();
          hideModal();
          moveToBlockedLocationAfterReactStateUpdate(location);
        },
        onDiscard: () => {
          panelEditor.onDiscard();
          hideModal();
          moveToBlockedLocationAfterReactStateUpdate(location);
        },
        onDismiss: hideModal,
      });
      return false;
    }

    // Are we still on the same dashboard?
    if (originalPath === location.pathname) {
      return true;
    }

    if (ignoreChanges(dashboard)) {
      return true;
    }

    if (!hasChangesToLose(dashboard)) {
      return true;
    }

    // Pending changes whose plugin keeps their history get here only with an edit it failed to record.
    const history = getPendingChangesHistory(dashboard.state);
    showModal(UnsavedChangesModal, {
      dashboard,
      onSaveDashboardClick: () => {
        hideModal();
        if (history) {
          // Saving that edit is recording it: try again, and leave once it's kept.
          void recordPendingChange(
            dashboard,
            history,
            t('dashboard-scene.lifecycle.edited-dashboard', 'Edit dashboard')
          ).then(() => {
            if (!hasUnrecordedPendingChange(dashboard)) {
              moveToBlockedLocationAfterReactStateUpdate(location);
            }
          });
          return;
        }
        dashboard.openSaveDrawer({
          onSaveSuccess: () => {
            moveToBlockedLocationAfterReactStateUpdate(location);
          },
        });
      },

      onDiscard: () => {
        // Restoring drops the unrecorded edit: leaving edit mode otherwise records it.
        dashboard.exitEditMode({ skipConfirm: true, ...(history ? { restoreInitialState: true } : {}) });
        hideModal();
        if (originalPath === DASHBOARD_LIBRARY_ROUTES.Template) {
          moveToBlockedLocationAfterReactStateUpdate(location, true);
        } else {
          moveToBlockedLocationAfterReactStateUpdate(location);
        }
      },
      onDismiss: hideModal,
    });

    return false;
  };

  return <Prompt when={true} message={onHistoryBlock} />;
});

DashboardPrompt.displayName = 'DashboardPrompt';

/** Whether leaving would lose an edit: an unsaved one, or one the pending changes' plugin failed to record. */
export function hasChangesToLose(scene: DashboardScene): boolean {
  return Boolean(scene.state.isDirty) || hasUnrecordedPendingChange(scene);
}

function moveToBlockedLocationAfterReactStateUpdate(location?: H.Location | null, replace = false) {
  if (location) {
    setTimeout(() => (replace ? locationService.replace(location) : locationService.push(location)), 10);
  }
}

interface UnsavedChangesModalProps {
  onDiscard: () => void;
  onDismiss: () => void;
  onSaveDashboardClick?: () => void;
}

const UnsavedChangesModal = ({ onDiscard, onDismiss, onSaveDashboardClick }: UnsavedChangesModalProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Modal
      isOpen={true}
      title={t('dashboard-scene.unsaved-changes-modal.title-unsaved-changes', 'Unsaved changes')}
      onDismiss={onDismiss}
      className={styles.modal}
    >
      <h5>
        <Trans i18nKey="dashboard-scene.unsaved-changes-modal.changes">Do you want to save your changes?</Trans>
      </h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          <Trans i18nKey="dashboard-scene.unsaved-changes-modal.cancel">Cancel</Trans>
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          <Trans i18nKey="dashboard-scene.unsaved-changes-modal.discard">Discard</Trans>
        </Button>
        <Button onClick={onSaveDashboardClick}>
          <Trans i18nKey="dashboard-scene.unsaved-changes-modal.save-dashboard">Save dashboard</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

const getStyles = () => ({
  modal: css({
    width: '500px',
  }),
});

/**
 * For some dashboards and users changes should be ignored *
 */
export function ignoreChanges(scene: DashboardScene | null) {
  const original = scene?.getInitialSaveModel();

  if (!original) {
    return true;
  }

  // Ignore changes if the user has been signed out
  if (!contextSrv.isSignedIn) {
    return true;
  }

  if (!scene) {
    return true;
  }

  // Edits to pending changes whose plugin keeps their history are recorded as they're made, unless
  // one is still on its way or failed. Before the version check: a draft has version 0.
  if (getPendingChangesHistory(scene.state)) {
    return !hasUnrecordedPendingChange(scene);
  }

  // Ignore changes if original is unsaved
  if (scene.state.meta.version === 0) {
    return true;
  }

  const dashboard = scene.getSaveModel();
  // Ignore changes if the dashboard is empty (new dashboard)
  if (isEmptyDashboard(dashboard, scene?.serializer.metadata)) {
    return true;
  }

  const { canSave, fromScript, fromFile } = scene.state.meta;
  if (!contextSrv.isEditor && !canSave) {
    return true;
  }

  return !canSave || fromScript || fromFile || (scene.state.isEditing && !hasActualSaveChanges(scene));
}

export function isEmptyDashboard(
  dashboard: Dashboard | DashboardV2Spec,
  metadata?: DashboardMeta | ObjectMeta
): boolean {
  if (isDashboardV2Spec(dashboard)) {
    const hasNoPanels = Object.keys(dashboard.elements).length === 0;
    const hasNoLinks = !dashboard.links.length;
    const hasNoTemplates = !dashboard.variables.length;
    const hasNoUid = !metadata || !('name' in metadata) || !metadata.name;

    return hasNoPanels && hasNoLinks && hasNoTemplates && hasNoUid;
  }

  const hasNoPanels = !dashboard.panels?.length;
  const hasNoLinks = !dashboard.links?.length;
  const hasNoTemplates = !dashboard.templating?.list?.length;
  const hasNoUid = !dashboard.uid;

  return hasNoPanels && hasNoLinks && hasNoTemplates && hasNoUid;
}
