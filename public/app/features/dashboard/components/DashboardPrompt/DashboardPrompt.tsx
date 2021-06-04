import { locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { contextSrv } from 'app/core/services/context_srv';
import React, { useEffect, useState } from 'react';
import { Prompt } from 'react-router-dom';
import { DashboardModel } from '../../state/DashboardModel';
import { each, filter, find } from 'lodash';
import angular from 'angular';
import { UnsavedChangesModal } from '../SaveDashboard/UnsavedChangesModal';
import * as H from 'history';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import { PanelModelWithLibraryPanel } from 'app/features/library-panels/types';
import { useDispatch } from 'react-redux';
import { discardPanelChanges } from '../PanelEditor/state/actions';
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
      return true;
    }

    if (ignoreChanges(dashboard, original)) {
      return true;
    }

    if (!hasChanges(dashboard, original)) {
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

function moveToBlockedLocationAfterReactStateUpdate(location?: H.Location | null) {
  if (location) {
    setTimeout(() => locationService.push(location!), 10);
  }
}

/**
 * For some dashboards and users changes should be ignored *
 */
export function ignoreChanges(current: DashboardModel, original: object | null) {
  if (!original) {
    return true;
  }

  // Ignore changes if the user has been signed out
  if (!contextSrv.isSignedIn) {
    return true;
  }

  if (!current || !current.meta) {
    return true;
  }

  const { canSave, fromScript, fromFile } = current.meta;
  if (!contextSrv.isEditor && !canSave) {
    return true;
  }

  return !canSave || fromScript || fromFile;
}

/**
 * Remove stuff that should not count in diff
 */
function cleanDashboardFromIgnoredChanges(dashData: any) {
  // need to new up the domain model class to get access to expand / collapse row logic
  const model = new DashboardModel(dashData);

  // Expand all rows before making comparison. This is required because row expand / collapse
  // change order of panel array and panel positions.
  model.expandRows();

  const dash = model.getSaveModelClone();

  // ignore time and refresh
  dash.time = 0;
  dash.refresh = 0;
  dash.schemaVersion = 0;
  dash.timezone = 0;

  // ignore iteration property
  delete dash.iteration;

  dash.panels = filter(dash.panels, (panel) => {
    if (panel.repeatPanelId) {
      return false;
    }

    // remove scopedVars
    panel.scopedVars = undefined;

    // ignore panel legend sort
    if (panel.legend) {
      delete panel.legend.sort;
      delete panel.legend.sortDesc;
    }

    return true;
  });

  // ignore template variable values
  each(dash.getVariables(), (variable: any) => {
    variable.current = null;
    variable.options = null;
    variable.filters = null;
  });

  return dash;
}

export function hasChanges(current: DashboardModel, original: any) {
  const currentClean = cleanDashboardFromIgnoredChanges(current.getSaveModelClone());
  const originalClean = cleanDashboardFromIgnoredChanges(original);

  const currentTimepicker: any = find((currentClean as any).nav, { type: 'timepicker' });
  const originalTimepicker: any = find((originalClean as any).nav, { type: 'timepicker' });

  if (currentTimepicker && originalTimepicker) {
    currentTimepicker.now = originalTimepicker.now;
  }

  const currentJson = angular.toJson(currentClean);
  const originalJson = angular.toJson(originalClean);
  console.log('current', currentJson);
  console.log('originalJson', originalJson);

  return currentJson !== originalJson;
}
