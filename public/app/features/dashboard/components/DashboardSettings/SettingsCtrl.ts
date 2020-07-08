import _ from 'lodash';
import angular, { ILocationService, IScope } from 'angular';
import { selectors } from '@grafana/e2e-selectors';

import { appEvents, contextSrv, coreModule } from 'app/core/core';
import { DashboardModel } from '../../state/DashboardModel';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSrv } from '../../services/DashboardSrv';
import { CoreEvents } from 'app/types';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { AppEvents, locationUtil, TimeZone, urlUtil } from '@grafana/data';
import { promiseToDigest } from '../../../../core/utils/promiseToDigest';

export class SettingsCtrl {
  dashboard: DashboardModel;
  isOpen: boolean;
  viewId: string;
  json: string;
  alertCount: number;
  canSaveAs: boolean;
  canSave: boolean;
  canDelete: boolean;
  sections: any[];
  hasUnsavedFolderChange: boolean;
  selectors: typeof selectors.pages.Dashboard.Settings.General;

  /** @ngInject */
  constructor(
    private $scope: IScope & Record<string, any>,
    private $route: any,
    private $location: ILocationService,
    private $rootScope: GrafanaRootScope,
    private dashboardSrv: DashboardSrv
  ) {
    // temp hack for annotations and variables editors
    // that rely on inherited scope
    $scope.dashboard = this.dashboard;

    this.$scope.$on('$destroy', () => {
      this.dashboard.updateSubmenuVisibility();
      setTimeout(() => {
        this.$rootScope.appEvent(CoreEvents.dashScroll, { restore: true });
        this.dashboard.startRefresh();
      });
    });

    this.canSaveAs = contextSrv.hasEditPermissionInFolders;
    this.canSave = this.dashboard.meta.canSave;
    this.canDelete = this.dashboard.meta.canSave;

    this.buildSectionList();
    this.onRouteUpdated();

    this.$rootScope.onAppEvent(CoreEvents.routeUpdated, this.onRouteUpdated.bind(this), $scope);
    this.$rootScope.appEvent(CoreEvents.dashScroll, { animate: false, pos: 0 });

    appEvents.on(CoreEvents.dashboardSaved, this.onPostSave.bind(this), $scope);

    this.selectors = selectors.pages.Dashboard.Settings.General;
  }

  buildSectionList() {
    this.sections = [];

    if (this.dashboard.meta.canEdit) {
      this.sections.push({
        title: 'General',
        id: 'settings',
        icon: 'sliders-v-alt',
      });
      this.sections.push({
        title: 'Annotations',
        id: 'annotations',
        icon: 'comment-alt',
      });
      this.sections.push({
        title: 'Variables',
        id: 'templating',
        icon: 'calculator-alt',
      });
      this.sections.push({
        title: 'Links',
        id: 'links',
        icon: 'link',
      });
    }

    if (this.dashboard.id && this.dashboard.meta.canSave) {
      this.sections.push({
        title: 'Versions',
        id: 'versions',
        icon: 'history',
      });
    }

    if (this.dashboard.id && this.dashboard.meta.canAdmin) {
      this.sections.push({
        title: 'Permissions',
        id: 'permissions',
        icon: 'lock',
      });
    }

    if (this.dashboard.meta.canMakeEditable) {
      this.sections.push({
        title: 'General',
        icon: 'sliders-v-alt',
        id: 'make_editable',
      });
    }

    this.sections.push({
      title: 'JSON Model',
      id: 'dashboard_json',
      icon: 'arrow',
    });

    const params = this.$location.search();
    const url = this.$location.path();

    for (const section of this.sections) {
      section.url = locationUtil.assureBaseUrl(urlUtil.renderUrl(url, { ...params, editview: section.id }));
    }
  }

  onRouteUpdated() {
    this.viewId = this.$location.search().editview;

    if (this.viewId) {
      this.json = angular.toJson(this.dashboard.getSaveModelClone(), true);
    }

    if (this.viewId === 'settings' && this.dashboard.meta.canMakeEditable) {
      this.viewId = 'make_editable';
    }

    const currentSection: any = _.find(this.sections, { id: this.viewId } as any);
    if (!currentSection) {
      this.sections.unshift({
        title: 'Not found',
        id: '404',
        icon: 'exclamation-triangle',
      });
      this.viewId = '404';
    }
  }
  saveDashboardJson() {
    this.dashboardSrv.saveJSONDashboard(this.json).then(() => {
      this.$route.reload();
    });
  }

  onPostSave() {
    this.hasUnsavedFolderChange = false;
  }

  hideSettings() {
    const urlParams = this.$location.search();
    delete urlParams.editview;
    setTimeout(() => {
      this.$rootScope.$apply(() => {
        this.$location.search(urlParams);
      });
    });
  }

  makeEditable() {
    this.dashboard.editable = true;
    this.dashboard.meta.canMakeEditable = false;
    this.dashboard.meta.canEdit = true;
    this.dashboard.meta.canSave = true;
    this.canDelete = true;
    this.viewId = 'settings';
    this.buildSectionList();

    const currentSection: any = _.find(this.sections, { id: this.viewId } as any);
    this.$location.url(locationUtil.stripBaseFromUrl(currentSection.url));
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

    const alerts = _.sumBy(this.dashboard.panels, panel => {
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
      backendSrv.deleteDashboard(this.dashboard.uid, false).then(() => {
        appEvents.emit(AppEvents.alertSuccess, ['Dashboard Deleted', this.dashboard.title + ' has been deleted']);
        this.$location.url('/');
      })
    );
  }

  onFolderChange = (folder: { id: number; title: string }) => {
    this.dashboard.meta.folderId = folder.id;
    this.dashboard.meta.folderTitle = folder.title;
    this.hasUnsavedFolderChange = true;
  };

  getFolder() {
    return {
      id: this.dashboard.meta.folderId,
      title: this.dashboard.meta.folderTitle,
      url: this.dashboard.meta.folderUrl,
    };
  }

  getDashboard = () => {
    return this.dashboard;
  };

  onRefreshIntervalChange = (intervals: string[]) => {
    this.dashboard.timepicker.refresh_intervals = intervals.filter(i => i.trim() !== '');
  };

  onNowDelayChange = (nowDelay: string) => {
    this.dashboard.timepicker.nowDelay = nowDelay;
  };

  onHideTimePickerChange = (hide: boolean) => {
    this.dashboard.timepicker.hidden = hide;
  };

  onTimeZoneChange = (timeZone: TimeZone) => {
    this.dashboard.timezone = timeZone;
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
