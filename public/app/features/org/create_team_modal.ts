///<reference path="../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export class CreateTeamCtrl {
  teamName = '';

  /** @ngInject */
  constructor(private backendSrv, private $location) {}

  createTeam() {
    this.backendSrv.post('/api/teams', { name: this.teamName }).then(result => {
      if (result.teamId) {
        this.$location.path('/org/teams/edit/' + result.teamId);
      }
      this.dismiss();
    });
  }

  dismiss() {
    appEvents.emit('hide-modal');
  }
}

export function createTeamModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/org/partials/create_team.html',
    controller: CreateTeamCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
  };
}

coreModule.directive('createTeamModal', createTeamModal);
