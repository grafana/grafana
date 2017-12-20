///<reference path="../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export class TeamsCtrl {
  teams: any;
  pages = [];
  perPage = 50;
  page = 1;
  totalPages: number;
  showPaging = false;
  query: any = '';
  navModel: any;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv) {
    this.navModel = navModelSrv.getNav('cfg', 'teams', 0);
    this.get();
  }

  get() {
    this.backendSrv
      .get(
        `/api/teams/search?perpage=${this.perPage}&page=${this.page}&query=${
          this.query
        }`
      )
      .then(result => {
        this.teams = result.teams;
        this.page = result.page;
        this.perPage = result.perPage;
        this.totalPages = Math.ceil(result.totalCount / result.perPage);
        this.showPaging = this.totalPages > 1;
        this.pages = [];

        for (var i = 1; i < this.totalPages + 1; i++) {
          this.pages.push({ page: i, current: i === this.page });
        }
      });
  }

  navigateToPage(page) {
    this.page = page.page;
    this.get();
  }

  deleteTeam(team) {
    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete Team ' + team.name + '?',
      yesText: 'Delete',
      icon: 'fa-warning',
      onConfirm: () => {
        this.deleteTeamConfirmed(team);
      },
    });
  }

  deleteTeamConfirmed(team) {
    this.backendSrv.delete('/api/teams/' + team.id).then(this.get.bind(this));
  }

  openTeamModal() {
    appEvents.emit('show-modal', {
      templateHtml: '<create-team-modal></create-team-modal>',
      modalClass: 'modal--narrow',
    });
  }
}

coreModule.controller('TeamsCtrl', TeamsCtrl);
