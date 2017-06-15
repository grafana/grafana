import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

const template = `
<div class="dropdown">
  <gf-form-dropdown model="ctrl.user"
                    get-options="ctrl.debouncedSearchUsers($query)"
                    css-class="gf-size-auto"
                    on-change="ctrl.onChange()"
  </gf-form-dropdown>
</div>
`;
export class UserPickerCtrl {
  user: any;
  userId: number;
  debouncedSearchUsers: any;

  /** @ngInject */
  constructor(private backendSrv, private $scope, $sce) {
    this.user = {text: 'Choose', value: null};
    this.debouncedSearchUsers = _.debounce(this.searchUsers, 500, {'leading': true, 'trailing': false});
  }

  searchUsers(query: string) {
    return Promise.resolve(this.backendSrv.get('/api/users/search?perpage=10&page=1&query=' + query).then(result => {
      return _.map(result.users, user => {
        return {text: user.login + ' -  ' + user.email, value: user.id};
      });
    }));
  }

  onChange() {
    this.userId = this.user.value;
  }

  userIdChanged() {
    if (this.userId === null) {
      this.user = {text: 'Choose', value: null};
    }
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
      userId: '=',
    },
    link: function(scope, elem, attrs, ctrl) {
      scope.$watch("ctrl.userId", (newVal, oldVal) => {
        ctrl.userIdChanged(newVal);
      });
    }
  };
}

coreModule.directive('userPicker', userPicker);
