import { coreModule, appEvents, contextSrv } from 'app/core/core';
import { DashboardModel } from '../dashboard_model';
import $ from 'jquery';
import _ from 'lodash';

export class SettingsCtrl {
  dashboard: DashboardModel;
  isOpen: boolean;
  viewId: string;
  json: string;
  alertCount: number;
  confirmValid: boolean;
  confirmText: string;
  sections: any[];

  /** @ngInject */
  constructor(private $scope, private $location, private $rootScope, private backendSrv, private dashboardSrv) {
    // temp hack for annotations and variables editors
    // that rely on inherited scope
    $scope.dashboard = this.dashboard;

    this.$scope.$on('$destroy', () => {
      this.dashboard.updateSubmenuVisibility();
      this.$rootScope.$broadcast('refresh');
    });

    this.alertCount = _.sumBy(this.dashboard.panels, panel => {
      return panel.alert ? 1 : 0;
    });

    this.confirmValid = this.alertCount === 0;
    this.onRouteUpdated();
    this.buildSectionList();

    $rootScope.onAppEvent('$routeUpdate', this.onRouteUpdated.bind(this), $scope);
  }

  buildSectionList() {
    this.sections = [];
    if (this.dashboard.meta.canEdit) {
      this.sections.push({ title: 'General', id: 'settings', icon: 'fa fa-fw fa-sliders' });
      this.sections.push({ title: 'Annotations', id: 'annotations', icon: 'fa fa-fw fa-comment-o' });
      this.sections.push({ title: 'Variables', id: 'templating', icon: 'fa fa-fw fa-dollar' });
      this.sections.push({ title: 'Links', id: 'links', icon: 'fa fa-fw fa-external-link' });

      if (this.dashboard.id) {
        this.sections.push({ title: 'Versions', id: 'versions', icon: 'fa fa-fw fa-history' });
      }
    }

    if (contextSrv.isEditor && !this.dashboard.editable) {
      this.sections.push({ title: 'Make Editable', icon: 'fa fa-fw fa-edit', id: 'make_editable' });
      this.viewId = 'make_editable';
    }

    this.sections.push({ title: 'View JSON', id: 'view_json', icon: 'fa fa-fw fa-code' });

    if (contextSrv.isEditor) {
      this.sections.push({ title: 'Save As', id: 'save_as', icon: 'fa fa-fw fa-copy' });
    }

    if (this.dashboard.meta.canSave) {
      this.sections.push({ title: 'Delete', id: 'delete', icon: 'fa fa-fw fa-trash' });
    }

    const params = this.$location.search();
    const url = this.$location.path();

    for (let section of this.sections) {
      const sectionParams = _.defaults({ editview: section.id }, params);
      section.url = url + '?' + $.param(sectionParams);
    }

    const currentSection = _.find(this.sections, { id: this.viewId });
    if (!currentSection) {
      this.sections.unshift({ title: 'Not found', id: '404', icon: 'fa fa-fw fa-warning' });
      this.viewId = '404';
      return;
    }
  }

  onRouteUpdated() {
    this.viewId = this.$location.search().editview;

    if (this.viewId) {
      this.json = JSON.stringify(this.dashboard.getSaveModelClone(), null, 2);
    }
  }

  hideSettings() {
    var urlParams = this.$location.search();
    delete urlParams.editview;
    setTimeout(() => {
      this.$rootScope.$apply(() => {
        this.$location.search(urlParams);
      });
    });
  }

  makeEditable() {
    this.dashboard.editable = true;

    return this.dashboardSrv.saveDashboard({ makeEditable: true, overwrite: false }).then(() => {
      // force refresh whole page
      window.location.href = window.location.href;
    });
  }

  confirmTextChanged() {
    this.confirmValid = this.confirmText === 'DELETE';
  }

  deleteDashboard() {
    this.backendSrv.delete('/api/dashboards/db/' + this.dashboard.meta.slug).then(() => {
      appEvents.emit('alert-success', ['Dashboard Deleted', this.dashboard.title + ' has been deleted']);
      this.$location.url('/');
    });
  }

  onFolderChange(folder) {
    this.dashboard.folderId = folder.id;
    this.dashboard.meta.folderId = folder.id;
    this.dashboard.meta.folderTitle = folder.title;
  }
}

export function dashboardSettings() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/settings/settings.html',
    controller: SettingsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    transclude: true,
    scope: { dashboard: '=' },
  };
}

coreModule.directive('dashboardSettings', dashboardSettings);
