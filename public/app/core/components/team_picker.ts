import coreModule from 'app/core/core_module';
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
export class TeamPickerCtrl {
  group: any;
  teamPicked: any;
  debouncedSearchGroups: any;

  /** @ngInject */
  constructor(private backendSrv) {
    this.debouncedSearchGroups = _.debounce(this.searchGroups, 500, {
      leading: true,
      trailing: false,
    });
    this.reset();
  }

  reset() {
    this.group = { text: 'Choose', value: null };
  }

  searchGroups(query: string) {
    return Promise.resolve(
      this.backendSrv.get('/api/teams/search?perpage=10&page=1&query=' + query).then(result => {
        return _.map(result.teams, ug => {
          return { text: ug.name, value: ug };
        });
      })
    );
  }

  onChange(option) {
    this.teamPicked({ $group: option.value });
  }
}

export function teamPicker() {
  return {
    restrict: 'E',
    template: template,
    controller: TeamPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      teamPicked: '&',
    },
    link: function(scope, elem, attrs, ctrl) {
      scope.$on('team-picker-reset', () => {
        ctrl.reset();
      });
    },
  };
}

coreModule.directive('teamPicker', teamPicker);
