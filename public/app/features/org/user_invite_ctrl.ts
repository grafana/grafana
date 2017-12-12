import coreModule from 'app/core/core_module';
import _ from 'lodash';

export class UserInviteCtrl {

  /** @ngInject **/
  constructor($scope, backendSrv, navModelSrv) {
    $scope.navModel = navModelSrv.getNav('cfg', 'users', 0);

    const defaultInvites = [
      {name: '', email: '', role: 'Editor'},
    ];

    $scope.invites = _.cloneDeep(defaultInvites);

    $scope.options = {skipEmails: false};
    $scope.init = function() { };

    $scope.addInvite = function() {
      $scope.invites.push({name: '', email: '', role: 'Editor'});
    };

    $scope.removeInvite = function(invite) {
      $scope.invites = _.without($scope.invites, invite);
    };

    $scope.resetInvites = function() {
      $scope.invites = _.cloneDeep(defaultInvites);
    };

    $scope.sendInvites = function() {
      if (!$scope.inviteForm.$valid) { return; }
      $scope.sendSingleInvite(0);
    };

    $scope.invitesSent = function() {
      $scope.resetInvites();
    };

    $scope.sendSingleInvite = function(index) {
      var invite = $scope.invites[index];
      invite.skipEmails = $scope.options.skipEmails;

      return backendSrv.post('/api/org/invites', invite).finally(function() {
        index += 1;

        if (index === $scope.invites.length) {
          $scope.invitesSent();
        } else {
          $scope.sendSingleInvite(index);
        }
      });
    };
  }
}

coreModule.controller('UserInviteCtrl', UserInviteCtrl);
