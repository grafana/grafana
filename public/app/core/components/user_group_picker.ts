import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

const template = `
<div class="dropdown">
  <gf-form-dropdown model="ctrl.group"
                    get-options="ctrl.debouncedSearchGroups($query)"
                    css-class="gf-size-auto"
                    on-change="ctrl.onChange($option)"
  </gf-form-dropdown>
</div>
`;
export class UserGroupPickerCtrl {
  group: any;
  userGroupPicked: any;
  debouncedSearchGroups: any;

  /** @ngInject */
  constructor(private backendSrv, private $scope, $sce, private uiSegmentSrv) {
    this.debouncedSearchGroups = _.debounce(this.searchGroups, 500, {'leading': true, 'trailing': false});
    this.reset();
  }

  reset() {
    this.group = {text: 'Choose', value: null};
  }

  searchGroups(query: string) {
    return Promise.resolve(this.backendSrv.get('/api/user-groups/search?perpage=10&page=1&query=' + query).then(result => {
      return _.map(result.userGroups, ug => {
        return {text: ug.name, value: ug};
      });
    }));
  }

  onChange(option) {
    this.userGroupPicked({$group: option.value});
  }
}

export function userGroupPicker() {
  return {
    restrict: 'E',
    template: template,
    controller: UserGroupPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      userGroupPicked: '&',
    },
    link: function(scope, elem, attrs, ctrl) {
      scope.$on("user-group-picker-reset", () => {
        ctrl.reset();
      });
    }
  };
}

coreModule.directive('userGroupPicker', userGroupPicker);
