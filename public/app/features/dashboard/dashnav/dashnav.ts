import moment from 'moment';
import angular from 'angular';
import { appEvents, NavModel } from 'app/core/core';
import { DashboardModel } from '../dashboard_model';

export class DashNavCtrl {
  dashboard: DashboardModel;
  navModel: NavModel;
  titleTooltip: string;

  /** @ngInject */
  constructor(private $scope, private dashboardSrv, private $location, public playlistSrv) {
    appEvents.on('save-dashboard', this.saveDashboard.bind(this), $scope);

    if (this.dashboard.meta.isSnapshot) {
      const meta = this.dashboard.meta;
      this.titleTooltip = 'Created: &nbsp;' + moment(meta.created).calendar();
      if (meta.expires) {
        this.titleTooltip += '<br>Expires: &nbsp;' + moment(meta.expires).fromNow() + '<br>';
      }
    }
  }

  toggleSettings() {
    const search = this.$location.search();
    if (search.editview) {
      delete search.editview;
    } else {
      search.editview = 'settings';
    }
    this.$location.search(search);
  }

  toggleViewMode() {
    appEvents.emit('toggle-kiosk-mode');
  }

  close() {
    const search = this.$location.search();
    if (search.editview) {
      delete search.editview;
    } else if (search.fullscreen) {
      delete search.fullscreen;
      delete search.edit;
      delete search.tab;
      delete search.panelId;
    }
    this.$location.search(search);
  }

  starDashboard() {
    this.dashboardSrv.starDashboard(this.dashboard.id, this.dashboard.meta.isStarred).then(newState => {
      this.dashboard.meta.isStarred = newState;
    });
  }

  shareDashboard(tabIndex) {
    const modalScope = this.$scope.$new();
    modalScope.tabIndex = tabIndex;
    modalScope.dashboard = this.dashboard;

    appEvents.emit('show-modal', {
      src: 'public/app/features/dashboard/partials/shareModal.html',
      scope: modalScope,
    });
  }

  hideTooltip(evt) {
    angular.element(evt.currentTarget).tooltip('hide');
  }

  saveDashboard() {
    return this.dashboardSrv.saveDashboard();
  }

  showSearch() {
    appEvents.emit('show-dash-search');
  }

  addPanel() {
    appEvents.emit('dash-scroll', { animate: true, evt: 0 });

    if (this.dashboard.panels.length > 0 && this.dashboard.panels[0].type === 'add-panel') {
      return; // Return if the "Add panel" exists already
    }

    this.dashboard.addPanel({
      type: 'add-panel',
      gridPos: { x: 0, y: 0, w: 12, h: 9 },
      title: 'Panel Title',
    });
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
    scope: { dashboard: '=' },
  };
}

angular.module('grafana.directives').directive('dashnav', dashNavDirective);
