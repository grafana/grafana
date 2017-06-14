import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

const template = `
<div class="dropdown">
  <metric-segment segment="ctrl.userGroupSegment"
    get-options="ctrl.debouncedSearchUserGroups($query)"
    on-change="ctrl.onChange()"></metric-segment>
  </div>
`;
export class UserGroupPickerCtrl {
  userGroupSegment: any;
  userGroupId: number;
  debouncedSearchUserGroups: any;

  /** @ngInject */
  constructor(private backendSrv, private $scope, $sce, private uiSegmentSrv) {
    this.debouncedSearchUserGroups = _.debounce(this.searchUserGroups, 500, {'leading': true, 'trailing': false});
    this.resetUserGroupSegment();
  }

  resetUserGroupSegment() {
    this.userGroupId = null;

    const userGroupSegment = this.uiSegmentSrv.newSegment({
      value: 'Choose',
      selectMode: true,
      fake: true,
      cssClass: 'gf-size-auto'
    });

    if (!this.userGroupSegment) {
      this.userGroupSegment = userGroupSegment;
    } else {
      this.userGroupSegment.value = userGroupSegment.value;
      this.userGroupSegment.html = userGroupSegment.html;
      this.userGroupSegment.value = userGroupSegment.value;
    }
  }

  userGroupIdChanged(newVal) {
    if (!newVal) {
      this.resetUserGroupSegment();
    }
  }

  searchUserGroups(query: string) {
    return Promise.resolve(this.backendSrv.get('/api/user-groups/search?perpage=10&page=1&query=' + query).then(result => {
      return _.map(result.userGroups, ug => { return this.uiSegmentSrv.newSegment(ug.name); });
    }));
  }

  onChange() {
    this.backendSrv.get('/api/user-groups/search?perpage=10&page=1&query=' + this.userGroupSegment.value)
      .then(result => {
        if (!result) {
          return;
        }

        result.userGroups.forEach(ug => {
          if (ug.name === this.userGroupSegment.value) {
            this.userGroupId = ug.id;
          }
        });
    });
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
      userGroupId: '=',
    },
    link: function(scope, elem, attrs, ctrl) {
      scope.$watch("ctrl.userGroupId", (newVal, oldVal) => {
        ctrl.userGroupIdChanged(newVal);
      });
    }
  };
}

coreModule.directive('userGroupPicker', userGroupPicker);
