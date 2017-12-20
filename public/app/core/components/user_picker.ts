import coreModule from 'app/core/core_module';
import _ from 'lodash';

const template = `
<div class="dropdown">
  <gf-form-dropdown model="ctrl.user"
                    get-options="ctrl.debouncedSearchUsers($query)"
                    css-class="gf-size-auto"
                    on-change="ctrl.onChange($option)"
  </gf-form-dropdown>
</div>
`;
export class UserPickerCtrl {
  user: any;
  debouncedSearchUsers: any;
  userPicked: any;

  /** @ngInject */
  constructor(private backendSrv) {
    this.reset();
    this.debouncedSearchUsers = _.debounce(this.searchUsers, 500, {
      leading: true,
      trailing: false,
    });
  }

  searchUsers(query: string) {
    return Promise.resolve(
      this.backendSrv
        .get('/api/users/search?perpage=10&page=1&query=' + query)
        .then(result => {
          return _.map(result.users, user => {
            return { text: user.login + ' -  ' + user.email, value: user };
          });
        })
    );
  }

  onChange(option) {
    this.userPicked({ $user: option.value });
  }

  reset() {
    this.user = { text: 'Choose', value: null };
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
      userPicked: '&',
    },
    link: function(scope, elem, attrs, ctrl) {
      scope.$on('user-picker-reset', () => {
        ctrl.reset();
      });
    },
  };
}

coreModule.directive('userPicker', userPicker);
