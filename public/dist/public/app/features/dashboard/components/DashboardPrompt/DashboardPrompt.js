import { find } from 'lodash';
import React, { useContext, useEffect, useState } from 'react';
import { Prompt } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { ModalsContext } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import { useDispatch } from 'app/types';
import { DashboardSavedEvent } from 'app/types/events';
import { DashboardModel } from '../../state/DashboardModel';
import { discardPanelChanges, exitPanelEditor } from '../PanelEditor/state/actions';
import { UnsavedChangesModal } from '../SaveDashboard/UnsavedChangesModal';
export const DashboardPrompt = React.memo(({ dashboard }) => {
    const [state, setState] = useState({ original: null });
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
        const handleUnload = (event) => {
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
    const onHistoryBlock = (location) => {
        var _a;
        const panelInEdit = dashboard.panelInEdit;
        const search = new URLSearchParams(location.search);
        // Are we leaving panel edit & library panel?
        if (panelInEdit && panelInEdit.libraryPanel && panelInEdit.hasChanged && !search.has('editPanel')) {
            showModal(SaveLibraryPanelModal, {
                isUnsavedPrompt: true,
                panel: dashboard.panelInEdit,
                folderUid: (_a = dashboard.meta.folderUid) !== null && _a !== void 0 ? _a : '',
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
                setState(Object.assign(Object.assign({}, state), { original: null }));
                hideModal();
                moveToBlockedLocationAfterReactStateUpdate(location);
            },
            onDismiss: hideModal,
        });
        return false;
    };
    return React.createElement(Prompt, { when: true, message: onHistoryBlock });
});
DashboardPrompt.displayName = 'DashboardPrompt';
function moveToBlockedLocationAfterReactStateUpdate(location) {
    if (location) {
        setTimeout(() => locationService.push(location), 10);
    }
}
/**
 * For some dashboards and users changes should be ignored *
 */
export function ignoreChanges(current, original) {
    if (!original) {
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
function cleanDashboardFromIgnoredChanges(dashData) {
    var _a;
    // need to new up the domain model class to get access to expand / collapse row logic
    const model = new DashboardModel(dashData);
    // Expand all rows before making comparison. This is required because row expand / collapse
    // change order of panel array and panel positions.
    model.expandRows();
    const dash = model.getSaveModelClone();
    // ignore time and refresh
    delete dash.time;
    dash.refresh = '';
    dash.schemaVersion = 0;
    delete dash.timezone;
    dash.panels = [];
    // ignore template variable values
    if ((_a = dash.templating) === null || _a === void 0 ? void 0 : _a.list) {
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
export function hasChanges(current, original) {
    if (current.hasUnsavedChanges()) {
        return true;
    }
    // TODO: Make getSaveModelClone return Dashboard type instead
    const currentClean = cleanDashboardFromIgnoredChanges(current.getSaveModelCloneOld());
    const originalClean = cleanDashboardFromIgnoredChanges(original);
    const currentTimepicker = find(currentClean.nav, { type: 'timepicker' });
    const originalTimepicker = find(originalClean.nav, { type: 'timepicker' });
    if (currentTimepicker && originalTimepicker) {
        currentTimepicker.now = originalTimepicker.now;
    }
    const currentJson = JSON.stringify(currentClean, null);
    const originalJson = JSON.stringify(originalClean, null);
    return currentJson !== originalJson;
}
//# sourceMappingURL=DashboardPrompt.js.map