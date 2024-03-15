import { css } from '@emotion/css';
import * as H from 'history';
import React, { useState, useContext, useEffect } from 'react';
import { Prompt } from 'react-router';

import { locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { ModalsContext, Modal, Button } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { DashboardScene } from '../scene/DashboardScene';

interface DashboardPromptProps {
  dashboard: DashboardScene;
}

interface DashboardPromptState {
  originalPath?: string;
}
export const DashboardPrompt = React.memo(({ dashboard }: DashboardPromptProps) => {
  const [state, setState] = useState<DashboardPromptState>({ originalPath: undefined });
  const { originalPath } = state;
  const { showModal, hideModal } = useContext(ModalsContext);

  useEffect(() => {
    // This timeout delay is to wait for panels to load and migrate scheme before capturing the original state
    // This is to minimize unsaved changes warnings due to automatic schema migrations
    const timeoutId = setTimeout(() => {
      const originalPath = locationService.getLocation().pathname;
      setState({ originalPath });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [dashboard, originalPath]);

  useEffect(() => {
    const handleUnload = (event: BeforeUnloadEvent) => {
      if (ignoreChanges(dashboard, dashboard.getInitialSaveModel())) {
        return;
      }
      if (dashboard.state.isDirty) {
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
    // const panelInEdit = dashboard.state.editPanel;
    // const search = new URLSearchParams(location.search);

    // TODO: Are we leaving panel edit & library panel?

    // if (panelInEdit && panelInEdit.libraryPanel && panelInEdit.hasChanged && !search.has('editPanel')) {
    //   showModal(SaveLibraryPanelModal, {
    //     isUnsavedPrompt: true,
    //     panel: dashboard.panelInEdit as PanelModelWithLibraryPanel,
    //     folderUid: dashboard.meta.folderUid ?? '',
    //     onConfirm: () => {
    //       hideModal();
    //       moveToBlockedLocationAfterReactStateUpdate(location);
    //     },
    //     onDiscard: () => {
    //       dispatch(discardPanelChanges());
    //       moveToBlockedLocationAfterReactStateUpdate(location);
    //       hideModal();
    //     },
    //     onDismiss: hideModal,
    //   });
    //   return false;
    // }

    // Are we still on the same dashboard?
    if (originalPath === location.pathname) {
      return true;
    }

    if (ignoreChanges(dashboard, dashboard.getInitialSaveModel())) {
      return true;
    }

    if (!dashboard.state.isDirty) {
      return true;
    }

    showModal(UnsavedChangesModal, {
      dashboard,
      onSaveDashboardClick: () => {
        hideModal();
        dashboard.openSaveDrawer({
          onSaveSuccess: () => {
            moveToBlockedLocationAfterReactStateUpdate(location);
          },
        });
      },

      onDiscard: () => {
        dashboard.exitEditMode({ skipConfirm: true });
        hideModal();
        moveToBlockedLocationAfterReactStateUpdate(location);
      },
      onDismiss: hideModal,
    });

    return false;
  };

  return <Prompt when={true} message={onHistoryBlock} />;
});

DashboardPrompt.displayName = 'DashboardPrompt';

function moveToBlockedLocationAfterReactStateUpdate(location?: H.Location | null) {
  if (location) {
    setTimeout(() => locationService.push(location), 10);
  }
}
interface UnsavedChangesModalProps {
  onDiscard: () => void;
  onDismiss: () => void;
  onSaveDashboardClick?: () => void;
}

export const UnsavedChangesModal = ({ onDiscard, onDismiss, onSaveDashboardClick }: UnsavedChangesModalProps) => {
  const styles = getStyles();
  return (
    <Modal
      isOpen={true}
      title="Unsaved changes"
      onDismiss={onDismiss}
      icon="exclamation-triangle"
      className={styles.modal}
    >
      <h5>Do you want to save your changes?</h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          Cancel
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          Discard
        </Button>
        <Button onClick={onSaveDashboardClick}>Save dashboard</Button>
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
export function ignoreChanges(current: DashboardScene | null, original?: Dashboard) {
  if (!original) {
    return true;
  }

  // Ignore changes if original is unsaved
  if ((original as Dashboard).version === 0) {
    return true;
  }

  // Ignore changes if the user has been signed out
  if (!contextSrv.isSignedIn) {
    return true;
  }

  if (!current) {
    return true;
  }

  const { canSave, fromScript, fromFile } = current.state.meta;
  if (!contextSrv.isEditor && !canSave) {
    return true;
  }

  return !canSave || fromScript || fromFile;
}
