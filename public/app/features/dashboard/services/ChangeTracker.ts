import _ from 'lodash';
import { DashboardModel } from '../state/DashboardModel';
import { contextSrv } from 'app/core/services/context_srv';
import { appEvents } from 'app/core/app_events';
import { UnsavedChangesModal } from '../components/SaveDashboard/UnsavedChangesModal';
import { DashboardSavedEvent, ShowModalReactEvent } from '../../../types/events';
import { locationService } from '@grafana/runtime';
import angular from 'angular';

export class ChangeTracker {
  init(dashboard: DashboardModel, originalCopyDelay: number) {
    let original: object | null = null;
    let originalPath = locationService.getLocation().pathname;

    // register events
    const savedEventUnsub = appEvents.subscribe(DashboardSavedEvent, () => {
      original = dashboard.getSaveModelClone();
      originalPath = locationService.getLocation().pathname;
    });

    if (originalCopyDelay && !dashboard.meta.fromExplore) {
      setTimeout(() => {
        // wait for different services to patch the dashboard (missing properties)
        original = dashboard.getSaveModelClone();
      }, originalCopyDelay);
    } else {
      original = dashboard.getSaveModelClone();
    }

    const history = locationService.getHistory();

    const blockUnsub = history.block((location) => {
      if (originalPath === location.pathname) {
        return;
      }

      if (this.ignoreChanges(dashboard, original)) {
        return;
      }

      if (!this.hasChanges(dashboard, original!)) {
        return;
      }

      appEvents.publish(
        new ShowModalReactEvent({
          component: UnsavedChangesModal,
          props: {
            dashboard: dashboard,
            onSaveSuccess: () => {
              original = dashboard.getSaveModelClone();
              history.push(location);
            },
            onDiscard: () => {
              original = dashboard.getSaveModelClone();
              history.push(location);
            },
          },
        })
      );

      return false;
    });

    const historyListenUnsub = history.listen((location) => {
      if (originalPath !== location.pathname) {
        blockUnsub();
        historyListenUnsub();
        savedEventUnsub.unsubscribe();
      }
    });
  }

  // for some dashboards and users
  // changes should be ignored
  ignoreChanges(current: DashboardModel, original: object | null) {
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
  cleanDashboardFromIgnoredChanges(dashData: any) {
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

    dash.panels = _.filter(dash.panels, (panel) => {
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
    _.each(dash.getVariables(), (variable: any) => {
      variable.current = null;
      variable.options = null;
      variable.filters = null;
    });

    return dash;
  }

  hasChanges(current: DashboardModel, original: any) {
    const currentClean = this.cleanDashboardFromIgnoredChanges(current.getSaveModelClone());
    const originalClean = this.cleanDashboardFromIgnoredChanges(original);

    const currentTimepicker: any = _.find((currentClean as any).nav, { type: 'timepicker' });
    const originalTimepicker: any = _.find((originalClean as any).nav, { type: 'timepicker' });

    if (currentTimepicker && originalTimepicker) {
      currentTimepicker.now = originalTimepicker.now;
    }

    const currentJson = angular.toJson(currentClean);
    const originalJson = angular.toJson(originalClean);

    return currentJson !== originalJson;
  }
}
