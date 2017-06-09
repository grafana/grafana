import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

const template = `
<div class="dropdown">
  <metric-segment segment="ctrl.userSegment"
    get-options="ctrl.debouncedSearchUsers($query)"
    on-change="ctrl.onChange()"></metric-segment>
  </div>
`;
export class UserPickerCtrl {
  userSegment: any;
  userLogin: string;
  userId: number;
  debouncedSearchUsers: any;

  /** @ngInject */
  constructor(private backendSrv, private $scope, $sce, private uiSegmentSrv) {
    this.userSegment = this.uiSegmentSrv.newSegment({value: 'Choose User', selectMode: true});
    this.debouncedSearchUsers = _.debounce(this.searchUsers, 500, {'leading': true, 'trailing': false});
  }

  searchUsers(query: string) {
    return Promise.resolve(this.backendSrv.get('/api/users/search?perpage=10&page=1&query=' + query).then(result => {
      return _.map(result.users, this.userKey.bind(this));
    }));
  }

  onChange() {
    this.userLogin = this.userSegment.value.split(' - ')[0];

    this.backendSrv.get('/api/users/search?perpage=10&page=1&query=' + this.userLogin)
      .then(result => {
        if (!result) {
          return;
        }

        result.users.forEach(u => {
          if (u.login === this.userLogin) {
            this.userId = u.id;
          }
        });
    });
  }

  private userKey(user: User) {
    return this.uiSegmentSrv.newSegment(user.login + ' - ' + user.email);
  }


}

export interface User {
  id: number;
  name: string;
  login: string;
  email: string;
}

export function userPicker() {
  return {
    restrict: 'E',
    template: template,
    controller: UserPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      userSegment: '=',
      userLogin: '=',
      userId: '=',
    }
  };
}

coreModule.directive('userPicker', userPicker);
