import $ from 'jquery';
import _ from 'lodash';
import angular, { ILocationService, IScope } from 'angular';
import { e2e } from '@grafana/e2e';

import { appEvents, contextSrv, coreModule } from 'app/core/core';
import { DashboardModel } from '../../state/DashboardModel';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSrv } from '../../services/DashboardSrv';
import { CoreEvents } from 'app/types';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { AppEvents } from '@grafana/data';
import { promiseToDigest } from '../../../../core/utils/promiseToDigest';
import locationUtil from 'app/core/utils/location_util';

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
  selectors: typeof e2e.pages.Dashboard.Settings.General.selectors;

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
    this.$rootScope.onAppEvent(CoreEvents.dashboardSaved, this.onPostSave.bind(this), $scope);
    this.selectors = e2e.pages.Dashboard.Settings.General.selectors;
  }

  buildSectionList() {
    this.sections = [];

    if (this.dashboard.meta.canEdit) {
      this.sections.push({
        title: 'General',
        id: 'settings',
        icon: 'gicon gicon-preferences',
      });
      this.sections.push({
        title: 'Annotations',
        id: 'annotations',
        icon: 'gicon gicon-annotation',
      });
      this.sections.push({
        title: 'Variables',
        id: 'templating',
        icon: 'gicon gicon-variable',
      });
      this.sections.push({
        title: 'Links',
        id: 'links',
        icon: 'gicon gicon-link',
      });
    }

    if (this.dashboard.id && this.dashboard.meta.canSave) {
      this.sections.push({
        title: 'Versions',
        id: 'versions',
        icon: 'fa fa-fw fa-history',
      });
    }

    if (this.dashboard.id && this.dashboard.meta.canAdmin) {
      this.sections.push({
        title: 'Permissions',
        id: 'permissions',
        icon: 'fa fa-fw fa-lock',
      });
    }

    if (this.dashboard.meta.canMakeEditable) {
      this.sections.push({
        title: 'General',
        icon: 'gicon gicon-preferences',
        id: 'make_editable',
      });
    }

    this.sections.push({
      title: 'JSON Model',
      id: 'dashboard_json',
      icon: 'gicon gicon-json',
    });

    const params = this.$location.search();
    const url = this.$location.path();

    for (const section of this.sections) {
      const sectionParams = _.defaults({ editview: section.id }, params);
      section.url = config.appSubUrl + url + '?' + $.param(sectionParams);
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
        icon: 'fa fa-fw fa-warning',
      });
      this.viewId = '404';
    }
  }

  openSaveAsModal() {
    this.dashboardSrv.showSaveAsModal();
  }

  saveDashboard() {
    this.dashboardSrv.saveDashboard();
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
        icon: 'fa-trash',
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
      icon: 'fa-trash',
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
