import coreModule from 'app/core/core_module';
import { backendSrv } from 'app/core/services/backend_srv';
import { ILocationService } from 'angular';
import { NavModelSrv } from 'app/core/core';

export class CreateTeamCtrl {
  name: string;
  email: string;
  navModel: any;

  /** @ngInject */
  constructor(private $location: ILocationService, navModelSrv: NavModelSrv) {
    this.navModel = navModelSrv.getNav('cfg', 'teams', 0);
  }

  create() {
    const payload = {
      name: this.name,
      email: this.email,
    };
    backendSrv.post('/api/teams', payload).then((result: any) => {
      if (result.teamId) {
        this.$location.path('/org/teams/edit/' + result.teamId);
      }
    });
  }
}

coreModule.controller('CreateTeamCtrl', CreateTeamCtrl);
