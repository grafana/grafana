import coreModule from 'app/core/core_module';

export default class CreateTeamCtrl {
  name: string;
  email: string;
  navModel: any;

  /** @ngInject **/
  constructor(private backendSrv, private $location, navModelSrv) {
    this.navModel = navModelSrv.getNav('cfg', 'teams', 0);
  }

  create() {
    const payload = {
      name: this.name,
      email: this.email,
    };
    this.backendSrv.post('/api/teams', payload).then(result => {
      if (result.teamId) {
        this.$location.path('/org/teams/edit/' + result.teamId);
      }
    });
  }
}

coreModule.controller('CreateTeamCtrl', CreateTeamCtrl);
