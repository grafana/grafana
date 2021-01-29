import _ from 'lodash';
import { ILocationService, IScope } from 'angular';
import { selectors } from '@grafana/e2e-selectors';

import { appEvents, coreModule } from 'app/core/core';
import { DashboardModel } from '../../state/DashboardModel';
import { CoreEvents } from 'app/types';
import { AppEvents, TimeZone } from '@grafana/data';
import { promiseToDigest } from '../../../../core/utils/promiseToDigest';
import { deleteDashboard } from 'app/features/manage-dashboards/state/actions';

export class SettingsCtrl {
  dashboard: DashboardModel;
  canSaveAs: boolean;
  canSave?: boolean;
  canDelete?: boolean;
  selectors: typeof selectors.pages.Dashboard.Settings.General;
  renderCount: number; // hack to update React when Angular changes

  /** @ngInject */
  constructor(private $scope: IScope & Record<string, any>, private $location: ILocationService) {
    // temp hack for annotations and variables editors
    // that rely on inherited scope
    $scope.dashboard = this.dashboard;
    this.canDelete = this.dashboard.meta.canSave;
    this.selectors = selectors.pages.Dashboard.Settings.General;
    this.renderCount = 0;
  }

  deleteDashboard() {
    let confirmText = '';
    let text2 = this.dashboard.title;

    if (this.dashboard.meta.provisioned) {
      appEvents.emit(CoreEvents.showConfirmModal, {
        title: 'Cannot delete provisioned dashboard',
        text: `
          This dashboard is managed by Grafanas provisioning and cannot be deleted. Remove the dashboard from the
          config file to delete it.
        `,
        text2: `
          <i>See <a class="external-link" href="http://docs.grafana.org/administration/provisioning/#dashboards" target="_blank">
          documentation</a> for more information about provisioning.</i>
          </br>
          File path: ${this.dashboard.meta.provisionedExternalId}
        `,
        text2htmlBind: true,
        icon: 'trash-alt',
        noText: 'OK',
      });
      return;
    }

    const alerts = _.sumBy(this.dashboard.panels, (panel) => {
      return panel.alert ? 1 : 0;
    });

    if (alerts > 0) {
      confirmText = 'DELETE';
      text2 = `This dashboard contains ${alerts} alerts. Deleting this dashboard will also delete those alerts`;
    }

    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Delete',
      text: 'Do you want to delete this dashboard?',
      text2: text2,
      icon: 'trash-alt',
      confirmText: confirmText,
      yesText: 'Delete',
      onConfirm: () => {
        this.dashboard.meta.canSave = false;
        this.deleteDashboardConfirmed();
      },
    });
  }

  deleteDashboardConfirmed() {
    promiseToDigest(this.$scope)(
      deleteDashboard(this.dashboard.uid, false).then(() => {
        appEvents.emit(AppEvents.alertSuccess, ['Dashboard Deleted', this.dashboard.title + ' has been deleted']);
        this.$location.url('/');
      })
    );
  }

  onFolderChange = (folder: { id: number; title: string }) => {
    this.dashboard.meta.folderId = folder.id;
    this.dashboard.meta.folderTitle = folder.title;
    this.dashboard.meta.hasUnsavedFolderChange = true;
  };

  onRefreshIntervalChange = (intervals: string[]) => {
    this.dashboard.timepicker.refresh_intervals = intervals.filter((i) => i.trim() !== '');
    this.renderCount++;
  };

  onNowDelayChange = (nowDelay: string) => {
    this.dashboard.timepicker.nowDelay = nowDelay;
    this.renderCount++;
  };

  onHideTimePickerChange = (hide: boolean) => {
    this.dashboard.timepicker.hidden = hide;
    this.renderCount++;
  };

  onTimeZoneChange = (timeZone: TimeZone) => {
    this.dashboard.timezone = timeZone;
    this.renderCount++;
  };
}

export function dashboardSettings() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/components/DashboardSettings/template.html',
    controller: SettingsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    transclude: true,
    scope: { dashboard: '=' },
  };
}

coreModule.directive('dashboardSettings', dashboardSettings);
