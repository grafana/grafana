import coreModule from "app/core/core_module";

export default class TeamDetailsCtrl {
  team: Team;
  teamMembers: User[] = [];
  navModel: any;

  /** @ngInject **/
  constructor(
    private $scope,
    private backendSrv,
    private $routeParams,
    navModelSrv
  ) {
    this.navModel = navModelSrv.getNav("cfg", "teams", 0);
    this.get = this.get.bind(this);
    this.get();
  }

  get() {
    if (this.$routeParams && this.$routeParams.id) {
      this.backendSrv.get(`/api/teams/${this.$routeParams.id}`).then(result => {
        this.team = result;
      });
<<<<<<< HEAD
      this.backendSrv.get(`/api/teams/${this.$routeParams.id}/members`).then(result => {
        this.teamMembers = result;
      });
=======
      this.backendSrv
        .get(`/api/teams/${this.$routeParams.id}/members`)
        .then(result => {
          this.teamMembers = result;
        });
>>>>>>> ux: POC on new select box for the user picker (#10289)
    }
  }

  removeTeamMember(teamMember: TeamMember) {
<<<<<<< HEAD
    this.$scope.appEvent('confirm-modal', {
      title: 'Remove Member',
      text: 'Are you sure you want to remove ' + teamMember.login + ' from this group?',
      yesText: 'Remove',
      icon: 'fa-warning',
=======
    this.$scope.appEvent("confirm-modal", {
      title: "Remove Member",
      text:
        "Are you sure you want to remove " +
        teamMember.login +
        " from this group?",
      yesText: "Remove",
      icon: "fa-warning",
>>>>>>> ux: POC on new select box for the user picker (#10289)
      onConfirm: () => {
        this.removeMemberConfirmed(teamMember);
      },
    });
  }

  removeMemberConfirmed(teamMember: TeamMember) {
<<<<<<< HEAD
    this.backendSrv.delete(`/api/teams/${this.$routeParams.id}/members/${teamMember.userId}`).then(this.get.bind(this));
=======
    this.backendSrv
      .delete(`/api/teams/${this.$routeParams.id}/members/${teamMember.userId}`)
      .then(this.get);
>>>>>>> ux: POC on new select box for the user picker (#10289)
  }

  update() {
    if (!this.$scope.teamDetailsForm.$valid) {
      return;
    }

<<<<<<< HEAD
    this.backendSrv.put('/api/teams/' + this.team.id, {
      name: this.team.name,
      email: this.team.email,
    });
  }

  userPicked(user) {
    this.backendSrv.post(`/api/teams/${this.$routeParams.id}/members`, { userId: user.id }).then(() => {
      this.$scope.$broadcast('user-picker-reset');
      this.get();
    });
=======
    this.backendSrv.put("/api/teams/" + this.team.id, { name: this.team.name });
  }

  userPicked(user) {
    this.backendSrv
      .post(`/api/teams/${this.$routeParams.id}/members`, { userId: user.id })
      .then(() => {
        this.$scope.$broadcast("user-picker-reset");
        this.get();
      });
>>>>>>> ux: POC on new select box for the user picker (#10289)
  }
}

export interface Team {
  id: number;
  name: string;
  email: string;
}

export interface User {
  id: number;
  name: string;
  login: string;
  email: string;
}

export interface TeamMember {
  userId: number;
  name: string;
  login: string;
}

<<<<<<< HEAD
coreModule.controller('TeamDetailsCtrl', TeamDetailsCtrl);
=======
coreModule.controller("TeamDetailsCtrl", TeamDetailsCtrl);
>>>>>>> ux: POC on new select box for the user picker (#10289)
