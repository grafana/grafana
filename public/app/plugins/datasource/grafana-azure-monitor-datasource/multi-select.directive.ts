import angular from 'angular';
import _ from 'lodash';

const template = `
<value-select-dropdown
  variable="ctrl.dsOptions"
  on-updated="ctrl.onChange(ctrl.dsOptions)"
  dashboard="ctrl.dashboard">
</value-select-dropdown>
`;

angular.module('grafana.directives').directive('multiSelect', () => {
  return {
    scope: {
      values: '=',
      options: '=',
      onChange: '&',
    },
    controller: DatasourceSelectorCtrl,
    controllerAs: 'ctrl',
    template: template,
  };
});

class DatasourceSelectorCtrl {
  /** @ngInject */
  scope: any;
  dsOptions: any;
  dashboard: any;

  constructor($scope: any) {
    this.scope = $scope;
    const values = $scope.values;
    const options = $scope.options;
    this.dsOptions = {
      multi: true,
      current: { value: values, text: values.join(' + ') },
      options: _.map(options, ds => {
        return { text: ds.text, value: ds.value, selected: _.includes(values, ds) };
      }),
    };
    this.dashboard = {
      on: () => {},
    };
  }

  onChange(updatedOptions: any) {
    const newValues = updatedOptions.current.value;
    this.scope.values = newValues;

    this.scope.$$postDigest(() => {
      this.scope.onChange();
    });
  }
}
