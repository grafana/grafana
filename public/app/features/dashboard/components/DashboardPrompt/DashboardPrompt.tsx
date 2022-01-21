import { locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import React, { useEffect, useState } from 'react';
import { Prompt } from 'react-router-dom';
import { DashboardModel } from '../../state/DashboardModel';
import { UnsavedChangesModal } from '../SaveDashboard/UnsavedChangesModal';
import * as H from 'history';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import { PanelModelWithLibraryPanel } from 'app/features/library-panels/types';
import { useDispatch } from 'react-redux';
import { discardPanelChanges, exitPanelEditor } from '../PanelEditor/state/actions';
import { DashboardSavedEvent } from 'app/types/events';

export interface Props {
  dashboard: DashboardModel;
}

interface State {
  original: object | null;
  originalPath?: string;
  modal: PromptModal | null;
  blockedLocation?: H.Location | null;
}

enum PromptModal {
  UnsavedChangesModal,
  SaveLibraryPanelModal,
}

export const DashboardPrompt = React.memo(({ dashboard }: Props) => {
  const [state, setState] = useState<State>({ original: null, modal: null });
  const dispatch = useDispatch();
  const { original, originalPath, blockedLocation, modal } = state;

  useEffect(() => {
    // This timeout delay is to wait for panels to load and migrate scheme before capturing the original state
    // This is to minimize unsaved changes warnings due to automatic schema migrations
    const timeoutId = setTimeout(() => {
      const originalPath = locationService.getLocation().pathname;
      const original = dashboard.getSaveModelClone();

      setState({ originalPath, original, modal: null });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [dashboard]);

  useEffect(() => {
    const handleUnload = (event: BeforeUnloadEvent) => {
      if (dashboard.hasUnsavedChanges()) {
        event.preventDefault();
        // No browser actually displays this message anymore.
        // But Chrome requires it to be defined else the popup won't show.
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [dashboard, original]);

  // Handle saved events
  useEffect(() => {
    const savedEventUnsub = appEvents.subscribe(DashboardSavedEvent, () => {
      const original = dashboard.getSaveModelClone();
      const originalPath = locationService.getLocation().pathname;
      setState({ originalPath, original, modal: null });

      if (blockedLocation) {
        moveToBlockedLocationAfterReactStateUpdate(blockedLocation);
      }
    });

    return () => savedEventUnsub.unsubscribe();
  }, [dashboard, blockedLocation]);

  const onHistoryBlock = (location: H.Location) => {
    const panelInEdit = dashboard.panelInEdit;
    const search = new URLSearchParams(location.search);

    // Are we leaving panel edit & library panel?
    if (panelInEdit && panelInEdit.libraryPanel && panelInEdit.hasChanged && !search.has('editPanel')) {
      setState({ ...state, modal: PromptModal.SaveLibraryPanelModal, blockedLocation: location });
      return false;
    }

    // Are we still on the same dashboard?
    if (originalPath === location.pathname || !original) {
      // This is here due to timing reasons we want the exit panel editor state changes to happen before router update
      if (panelInEdit && !search.has('editPanel')) {
        dispatch(exitPanelEditor());
      }

      return true;
    }

    if (!dashboard.hasUnsavedChanges()) {
      return true;
    }

    setState({ ...state, modal: PromptModal.UnsavedChangesModal, blockedLocation: location });
    return false;
  };

  const onHideModalAndMoveToBlockedLocation = () => {
    setState({ ...state, modal: null });
    moveToBlockedLocationAfterReactStateUpdate(blockedLocation);
  };

  return (
    <>
      <Prompt when={true} message={onHistoryBlock} />
      {modal === PromptModal.UnsavedChangesModal && (
        <UnsavedChangesModal
          dashboard={dashboard}
          onSaveSuccess={() => {}} // Handled by DashboardSavedEvent above
          onDiscard={() => {
            // Clear original will allow us to leave without unsaved changes prompt
            setState({ ...state, original: null, modal: null });
            moveToBlockedLocationAfterReactStateUpdate(blockedLocation);
          }}
          onDismiss={() => {
            setState({ ...state, modal: null, blockedLocation: null });
          }}
        />
      )}
      {modal === PromptModal.SaveLibraryPanelModal && (
        <SaveLibraryPanelModal
          isUnsavedPrompt
          panel={dashboard.panelInEdit as PanelModelWithLibraryPanel}
          folderId={dashboard.meta.folderId as number}
          onConfirm={onHideModalAndMoveToBlockedLocation}
          onDiscard={() => {
            dispatch(discardPanelChanges());
            setState({ ...state, modal: null });
            moveToBlockedLocationAfterReactStateUpdate(blockedLocation);
          }}
          onDismiss={() => {
            setState({ ...state, modal: null, blockedLocation: null });
          }}
        />
      )}
    </>
  );
});

DashboardPrompt.displayName = 'DashboardPrompt';

function moveToBlockedLocationAfterReactStateUpdate(location?: H.Location | null) {
  if (location) {
    setTimeout(() => locationService.push(location!), 10);
  }
}
