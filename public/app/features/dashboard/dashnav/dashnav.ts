///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import angular from 'angular';
import {appEvents, NavModel} from 'app/core/core';
import {DashboardModel} from '../model';
import {DashboardExporter} from '../export/exporter';

export class DashNavCtrl {
  dashboard: DashboardModel;
  navModel: NavModel;
  titleTooltip: string;

  /** @ngInject */
  constructor(
    private $scope,
    private $rootScope,
    private dashboardSrv,
    private $location,
    private playlistSrv,
    private backendSrv,
    private $timeout,
    private datasourceSrv,
    private navModelSrv,
    private contextSrv) {
      this.navModel = navModelSrv.getDashboardNav(this.dashboard, this);

      appEvents.on('save-dashboard', this.saveDashboard.bind(this), $scope);
      appEvents.on('delete-dashboard', this.deleteDashboard.bind(this), $scope);

      if (this.dashboard.meta.isSnapshot) {
        var meta = this.dashboard.meta;
        this.titleTooltip = 'Created: &nbsp;' + moment(meta.created).calendar();
        if (meta.expires) {
          this.titleTooltip += '<br>Expires: &nbsp;' + moment(meta.expires).fromNow() + '<br>';
        }
      }
    }

    toggleSideMenu() {
      this.contextSrv.toggleSideMenu();
    }

    openEditView(editview) {
      var search = _.extend(this.$location.search(), {editview: editview});
      this.$location.search(search);
    }

    showHelpModal() {
      appEvents.emit('show-modal', {templateHtml: '<help-modal></help-modal>'});
    }

    starDashboard() {
      if (this.dashboard.meta.isStarred) {
        return this.backendSrv.delete('/api/user/stars/dashboard/' + this.dashboard.id).then(() =>  {
          this.dashboard.meta.isStarred = false;
        });
      }

      this.backendSrv.post('/api/user/stars/dashboard/' + this.dashboard.id).then(() => {
        this.dashboard.meta.isStarred = true;
      });
    }

    shareDashboard(tabIndex) {
      var modalScope = this.$scope.$new();
      modalScope.tabIndex = tabIndex;
      modalScope.dashboard = this.dashboard;

      appEvents.emit('show-modal', {
        src: 'public/app/features/dashboard/partials/shareModal.html',
        scope: modalScope
      });
    }

    hideTooltip(evt) {
      angular.element(evt.currentTarget).tooltip('hide');
    }

    makeEditable() {
      this.dashboard.editable = true;

      return this.dashboardSrv.saveDashboard({makeEditable: true, overwrite: false}).then(() => {
        // force refresh whole page
        window.location.href = window.location.href;
      });
    }

    exitFullscreen() {
      this.$rootScope.appEvent('panel-change-view', {fullscreen: false, edit: false});
    }

    saveDashboard() {
      return this.dashboardSrv.saveDashboard();
    }

    deleteDashboard() {
      var confirmText = "";
      var text2 = this.dashboard.title;
      var alerts = this.dashboard.rows.reduce((memo, row) => {
        memo += row.panels.filter(panel => panel.alert).length;
        return memo;
      }, 0);

      if (alerts > 0) {
        confirmText = 'DELETE';
        text2 = `This dashboad contains ${alerts} alerts. Deleting this dashboad will also delete those alerts`;
      }

      appEvents.emit('confirm-modal', {
        title: 'Delete',
        text: 'Do you want to delete this dashboard?',
        text2: text2,
        icon: 'fa-trash',
        confirmText: confirmText,
        yesText: 'Delete',
        onConfirm: () => {
          this.dashboard.meta.canSave = false;
          this.deleteDashboardConfirmed();
        }
      });
    }

    deleteDashboardConfirmed() {
      this.backendSrv.delete('/api/dashboards/db/' + this.dashboard.meta.slug).then(() => {
        appEvents.emit('alert-success', ['Dashboard Deleted', this.dashboard.title + ' has been deleted']);
        this.$location.url('/');
      });
    }

    saveDashboardAs() {
      return this.dashboardSrv.showSaveAsModal();
    }

    viewJson() {
      var clone = this.dashboard.getSaveModelClone();

      this.$rootScope.appEvent('show-json-editor', {
        object: clone,
      });
    }

    showSearch() {
      this.$rootScope.appEvent('show-dash-search');
    }

    navItemClicked(navItem, evt) {
      if (navItem.clickHandler) {
        navItem.clickHandler();
        evt.preventDefault();
      }
    }
}

export function dashNavDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/dashnav/dashnav.html',
    controller: DashNavCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    transclude: true,
    scope: { dashboard: "=" }
  };
}

angular.module('grafana.directives').directive('dashnav', dashNavDirective);
