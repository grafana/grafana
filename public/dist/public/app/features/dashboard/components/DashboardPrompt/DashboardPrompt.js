import { __assign, __read } from "tslib";
import { locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { contextSrv } from 'app/core/services/context_srv';
import React, { useEffect, useState } from 'react';
import { Prompt } from 'react-router-dom';
import { DashboardModel } from '../../state/DashboardModel';
import { each, filter, find } from 'lodash';
import angular from 'angular';
import { UnsavedChangesModal } from '../SaveDashboard/UnsavedChangesModal';
import { SaveLibraryPanelModal } from 'app/features/library-panels/components/SaveLibraryPanelModal/SaveLibraryPanelModal';
import { useDispatch } from 'react-redux';
import { discardPanelChanges, exitPanelEditor } from '../PanelEditor/state/actions';
import { DashboardSavedEvent } from 'app/types/events';
var PromptModal;
(function (PromptModal) {
    PromptModal[PromptModal["UnsavedChangesModal"] = 0] = "UnsavedChangesModal";
    PromptModal[PromptModal["SaveLibraryPanelModal"] = 1] = "SaveLibraryPanelModal";
})(PromptModal || (PromptModal = {}));
export var DashboardPrompt = React.memo(function (_a) {
    var dashboard = _a.dashboard;
    var _b = __read(useState({ original: null, modal: null }), 2), state = _b[0], setState = _b[1];
    var dispatch = useDispatch();
    var original = state.original, originalPath = state.originalPath, blockedLocation = state.blockedLocation, modal = state.modal;
    useEffect(function () {
        // This timeout delay is to wait for panels to load and migrate scheme before capturing the original state
        // This is to minimize unsaved changes warnings due to automatic schema migrations
        var timeoutId = setTimeout(function () {
            var originalPath = locationService.getLocation().pathname;
            var original = dashboard.getSaveModelClone();
            setState({ originalPath: originalPath, original: original, modal: null });
        }, 1000);
        return function () {
            clearTimeout(timeoutId);
        };
    }, [dashboard]);
    useEffect(function () {
        var handleUnload = function (event) {
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
        return function () { return window.removeEventListener('beforeunload', handleUnload); };
    }, [dashboard, original]);
    // Handle saved events
    useEffect(function () {
        var savedEventUnsub = appEvents.subscribe(DashboardSavedEvent, function () {
            var original = dashboard.getSaveModelClone();
            var originalPath = locationService.getLocation().pathname;
            setState({ originalPath: originalPath, original: original, modal: null });
            if (blockedLocation) {
                moveToBlockedLocationAfterReactStateUpdate(blockedLocation);
            }
        });
        return function () { return savedEventUnsub.unsubscribe(); };
    }, [dashboard, blockedLocation]);
    var onHistoryBlock = function (location) {
        var panelInEdit = dashboard.panelInEdit;
        var search = new URLSearchParams(location.search);
        // Are we leaving panel edit & library panel?
        if (panelInEdit && panelInEdit.libraryPanel && panelInEdit.hasChanged && !search.has('editPanel')) {
            setState(__assign(__assign({}, state), { modal: PromptModal.SaveLibraryPanelModal, blockedLocation: location }));
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
        setState(__assign(__assign({}, state), { modal: PromptModal.UnsavedChangesModal, blockedLocation: location }));
        return false;
    };
    var onHideModalAndMoveToBlockedLocation = function () {
        setState(__assign(__assign({}, state), { modal: null }));
        moveToBlockedLocationAfterReactStateUpdate(blockedLocation);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Prompt, { when: true, message: onHistoryBlock }),
        modal === PromptModal.UnsavedChangesModal && (React.createElement(UnsavedChangesModal, { dashboard: dashboard, onSaveSuccess: function () { }, onDiscard: function () {
                // Clear original will allow us to leave without unsaved changes prompt
                setState(__assign(__assign({}, state), { original: null, modal: null }));
                moveToBlockedLocationAfterReactStateUpdate(blockedLocation);
            }, onDismiss: function () {
                setState(__assign(__assign({}, state), { modal: null, blockedLocation: null }));
            } })),
        modal === PromptModal.SaveLibraryPanelModal && (React.createElement(SaveLibraryPanelModal, { isUnsavedPrompt: true, panel: dashboard.panelInEdit, folderId: dashboard.meta.folderId, onConfirm: onHideModalAndMoveToBlockedLocation, onDiscard: function () {
                dispatch(discardPanelChanges());
                setState(__assign(__assign({}, state), { modal: null }));
                moveToBlockedLocationAfterReactStateUpdate(blockedLocation);
            }, onDismiss: function () {
                setState(__assign(__assign({}, state), { modal: null, blockedLocation: null }));
            } }))));
});
function moveToBlockedLocationAfterReactStateUpdate(location) {
    if (location) {
        setTimeout(function () { return locationService.push(location); }, 10);
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
    if (!current || !current.meta) {
        return true;
    }
    var _a = current.meta, canSave = _a.canSave, fromScript = _a.fromScript, fromFile = _a.fromFile;
    if (!contextSrv.isEditor && !canSave) {
        return true;
    }
    return !canSave || fromScript || fromFile;
}
/**
 * Remove stuff that should not count in diff
 */
function cleanDashboardFromIgnoredChanges(dashData) {
    // need to new up the domain model class to get access to expand / collapse row logic
    var model = new DashboardModel(dashData);
    // Expand all rows before making comparison. This is required because row expand / collapse
    // change order of panel array and panel positions.
    model.expandRows();
    var dash = model.getSaveModelClone();
    // ignore time and refresh
    dash.time = 0;
    dash.refresh = 0;
    dash.schemaVersion = 0;
    dash.timezone = 0;
    // ignore iteration property
    delete dash.iteration;
    dash.panels = filter(dash.panels, function (panel) {
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
    each(dash.getVariables(), function (variable) {
        variable.current = null;
        variable.options = null;
        variable.filters = null;
    });
    return dash;
}
export function hasChanges(current, original) {
    var currentClean = cleanDashboardFromIgnoredChanges(current.getSaveModelClone());
    var originalClean = cleanDashboardFromIgnoredChanges(original);
    var currentTimepicker = find(currentClean.nav, { type: 'timepicker' });
    var originalTimepicker = find(originalClean.nav, { type: 'timepicker' });
    if (currentTimepicker && originalTimepicker) {
        currentTimepicker.now = originalTimepicker.now;
    }
    var currentJson = angular.toJson(currentClean);
    var originalJson = angular.toJson(originalClean);
    return currentJson !== originalJson;
}
//# sourceMappingURL=DashboardPrompt.js.map