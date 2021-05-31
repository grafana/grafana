import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import React, { useEffect, useState } from 'react';
import { Prompt } from 'react-router-dom';
import { DashboardModel } from '../../state/DashboardModel';
import { each, filter, find } from 'lodash';
import angular from 'angular';
import { UnsavedChangesModal } from '../SaveDashboard/UnsavedChangesModal';
import * as H from 'history';

export interface Props {
  dashboard: DashboardModel;
}

interface State {
  original: object | null;
  originalPath?: string;
  isOpen?: boolean;
  blockedLocation?: H.Location | null;
}

export const DashboardPrompt = React.memo(({ dashboard }: Props) => {
  const [state, setState] = useState<State>({ original: null });
  const { isOpen, original, originalPath, blockedLocation } = state;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const originalPath = locationService.getLocation().pathname;
      const original = dashboard.getSaveModelClone();

      setState({ ...state, originalPath, original });
    });

    return () => {
      clearTimeout(timeoutId);
    };
  }, [dashboard]);

  const onSaveSuccess = () => {
    setState({ ...state, original: null, isOpen: false });
    setTimeout(() => locationService.push(blockedLocation!), 10);
  };

  const onDiscard = () => {
    setState({ ...state, original: null, isOpen: false });
    setTimeout(() => locationService.push(blockedLocation!), 10);
  };

  const onDismiss = () => {
    setState({ ...state, isOpen: false });
  };

  return (
    <>
      <Prompt
        when={true}
        message={(location) => {
          if (originalPath === location.pathname || !original) {
            return true;
          }

          if (ignoreChanges(dashboard, original)) {
            return true;
          }

          if (!hasChanges(dashboard, original)) {
            return true;
          }

          setState({ ...state, isOpen: true, blockedLocation: location });
          return false;
        }}
      />
      {isOpen && (
        <UnsavedChangesModal
          dashboard={dashboard}
          onSaveSuccess={onSaveSuccess}
          onDiscard={onDiscard}
          onDismiss={onDismiss}
        />
      )}
    </>
  );
});

// for some dashboards and users
// changes should be ignored
function ignoreChanges(current: DashboardModel, original: object | null) {
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

// remove stuff that should not count in diff
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

function hasChanges(current: DashboardModel, original: any) {
  const currentClean = cleanDashboardFromIgnoredChanges(current.getSaveModelClone());
  const originalClean = cleanDashboardFromIgnoredChanges(original);

  const currentTimepicker: any = find((currentClean as any).nav, { type: 'timepicker' });
  const originalTimepicker: any = find((originalClean as any).nav, { type: 'timepicker' });

  if (currentTimepicker && originalTimepicker) {
    currentTimepicker.now = originalTimepicker.now;
  }

  const currentJson = angular.toJson(currentClean);
  const originalJson = angular.toJson(originalClean);

  return currentJson !== originalJson;
}
