import * as H from 'history';
import { find } from 'lodash';
import { memo, useContext, useEffect, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { ModalsContext } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Prompt } from 'app/core/components/FormPrompt/Prompt';
import { contextSrv } from 'app/core/services/context_srv';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import { PanelModelWithLibraryPanel } from 'app/features/library-panels/types';
import { DashboardSavedEvent } from 'app/types/events';
import { useDispatch } from 'app/types/store';

import { DashboardModel } from '../../state/DashboardModel';
import { discardPanelChanges, exitPanelEditor } from '../PanelEditor/state/actions';
import { UnsavedChangesModal } from '../SaveDashboard/UnsavedChangesModal';

export interface Props {
  dashboard: DashboardModel;
}

interface State {
  original: object | null;
  originalPath?: string;
}

export const DashboardPrompt = memo(({ dashboard }: Props) => {
  const [state, setState] = useState<State>({ original: null });
  const dispatch = useDispatch();
  const { original, originalPath } = state;
  const { showModal, hideModal } = useContext(ModalsContext);

  useEffect(() => {
    // This timeout delay is to wait for panels to load and migrate scheme before capturing the original state
    // This is to minimize unsaved changes warnings due to automatic schema migrations
    const timeoutId = setTimeout(() => {
      const originalPath = locationService.getLocation().pathname;
      const original = dashboard.getSaveModelCloneOld();
      setState({ originalPath, original });
    }, 1000);

    const savedEventUnsub = appEvents.subscribe(DashboardSavedEvent, () => {
      const original = dashboard.getSaveModelCloneOld();
      setState({ originalPath, original });
    });

    return () => {
      clearTimeout(timeoutId);
      savedEventUnsub.unsubscribe();
    };
  }, [dashboard, originalPath]);

  useEffect(() => {
    const handleUnload = (event: BeforeUnloadEvent) => {
      if (ignoreChanges(dashboard, original)) {
        return;
      }
      if (hasChanges(dashboard, original)) {
        event.preventDefault();
        // No browser actually displays this message anymore.
        // But Chrome requires it to be defined else the popup won't show.
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [dashboard, original]);

  const onHistoryBlock = (location: H.Location) => {
    const panelInEdit = dashboard.panelInEdit;
    const search = new URLSearchParams(location.search);

    // Are we leaving panel edit & library panel?
    if (panelInEdit && panelInEdit.libraryPanel && panelInEdit.hasChanged && !search.has('editPanel')) {
      showModal(SaveLibraryPanelModal, {
        isUnsavedPrompt: true,
        panel: dashboard.panelInEdit as PanelModelWithLibraryPanel,
        folderUid: dashboard.meta.folderUid ?? '',
        onConfirm: () => {
          hideModal();
          moveToBlockedLocationAfterReactStateUpdate(location);
        },
        onDiscard: () => {
          dispatch(discardPanelChanges());
          moveToBlockedLocationAfterReactStateUpdate(location);
          hideModal();
        },
        onDismiss: hideModal,
      });
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

    if (ignoreChanges(dashboard, original)) {
      return true;
    }

    if (!hasChanges(dashboard, original)) {
      return true;
    }

    showModal(UnsavedChangesModal, {
      dashboard: dashboard,
      onSaveSuccess: () => {
        hideModal();
        moveToBlockedLocationAfterReactStateUpdate(location);
      },
      onDiscard: () => {
        setState({ ...state, original: null });
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

/**
 * For some dashboards and users changes should be ignored *
 */
export function ignoreChanges(current: DashboardModel | null, original: object | null) {
  if (!original) {
    return true;
  }

  // Ignore changes if original is unsaved
  if ((original as DashboardModel).version === 0) {
    return true;
  }

  // Ignore changes if the user has been signed out
  if (!contextSrv.isSignedIn) {
    return true;
  }

  if (!current) {
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
function cleanDashboardFromIgnoredChanges(dashData: Dashboard) {
  // need to new up the domain model class to get access to expand / collapse row logic
  const model = new DashboardModel(dashData);

  // Expand all rows before making comparison. This is required because row expand / collapse
  // change order of panel array and panel positions.
  model.expandRows();

  const dash = model.getSaveModelClone();

  // ignore time and refresh
  delete dash.time;
  delete dash.refresh;
  dash.schemaVersion = 0;
  delete dash.timezone;

  dash.panels = [];

  // ignore template variable values
  if (dash.templating?.list) {
    for (const variable of dash.templating.list) {
      delete variable.current;
      delete variable.options;
      // @ts-expect-error
      delete variable.filters;
    }
  }

  return dash;
}

// TODO: Adapt original to be Dashboard type instead
export function hasChanges(current: DashboardModel, original: unknown) {
  if (current.hasUnsavedChanges()) {
    return true;
  }

  // TODO: Make getSaveModelClone return Dashboard type instead
  const currentClean = cleanDashboardFromIgnoredChanges(current.getSaveModelCloneOld() as unknown as Dashboard);
  const originalClean = cleanDashboardFromIgnoredChanges(original as Dashboard);

  const currentTimepicker = find((currentClean as any).nav, { type: 'timepicker' });
  const originalTimepicker = find((originalClean as any).nav, { type: 'timepicker' });

  if (currentTimepicker && originalTimepicker) {
    currentTimepicker.now = originalTimepicker.now;
  }

  const currentJson = JSON.stringify(currentClean, null);
  const originalJson = JSON.stringify(originalClean, null);

  return currentJson !== originalJson;
}
