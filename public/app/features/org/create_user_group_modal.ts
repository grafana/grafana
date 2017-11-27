///<reference path="../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export class CreateUserGroupCtrl {
  userGroupName = '';

  /** @ngInject */
  constructor(private backendSrv, private $location) {
  }

  createUserGroup() {
    this.backendSrv.post('/api/user-groups', {name: this.userGroupName}).then((result) => {
      if (result.userGroupId) {
        this.$location.path('/org/user-groups/edit/' + result.userGroupId);
      }
      this.dismiss();
    });
  }

  dismiss() {
    appEvents.emit('hide-modal');
  }
}

export function createUserGroupModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/org/partials/create_user_group.html',
    controller: CreateUserGroupCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
  };
}

coreModule.directive('createUserGroupModal', createUserGroupModal);
