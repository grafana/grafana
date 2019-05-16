import _ from 'lodash';
import angular from 'angular';
import coreModule from 'app/core/core_module';
import { DashboardModel } from 'app/features/dashboard/state';

export class AdHocFiltersCtrl {
  segments: any;
  variable: any;
  dashboard: DashboardModel;
  removeTagFilterSegment: any;

  /** @ngInject */
  constructor(private uiSegmentSrv, private datasourceSrv, private $q, private variableSrv, $scope) {
    this.removeTagFilterSegment = uiSegmentSrv.newSegment({
      fake: true,
      value: '-- remove filter --',
    });
    this.buildSegmentModel();
    this.dashboard.events.on('template-variable-value-updated', this.buildSegmentModel.bind(this), $scope);
  }

  buildSegmentModel() {
    this.segments = [];

    if (this.variable.value && !_.isArray(this.variable.value)) {
    }

    for (const tag of this.variable.filters) {
      if (this.segments.length > 0) {
        this.segments.push(this.uiSegmentSrv.newCondition('AND'));
      }

      if (tag.key !== undefined && tag.value !== undefined) {
        this.segments.push(this.uiSegmentSrv.newKey(tag.key));
        this.segments.push(this.uiSegmentSrv.newOperator(tag.operator));
        this.segments.push(this.uiSegmentSrv.newKeyValue(tag.value));
      }
    }

    this.segments.push(this.uiSegmentSrv.newPlusButton());
  }

  getOptions(segment, index) {
    if (segment.type === 'operator') {
      return this.$q.when(this.uiSegmentSrv.newOperators(['=', '!=', '<', '>', '=~', '!~']));
    }

    if (segment.type === 'condition') {
      return this.$q.when([this.uiSegmentSrv.newSegment('AND')]);
    }

    return this.datasourceSrv.get(this.variable.datasource).then(ds => {
      const options: any = {};
      let promise = null;

      if (segment.type !== 'value') {
        promise = ds.getTagKeys ? ds.getTagKeys() : Promise.resolve([]);
      } else {
        options.key = this.segments[index - 2].value;
        promise = ds.getTagValues ? ds.getTagValues(options) : Promise.resolve([]);
      }

      return promise.then(results => {
        results = _.map(results, segment => {
          return this.uiSegmentSrv.newSegment({ value: segment.text });
        });

        // add remove option for keys
        if (segment.type === 'key') {
          results.splice(0, 0, angular.copy(this.removeTagFilterSegment));
        }
        return results;
      });
    });
  }

  segmentChanged(segment, index) {
    this.segments[index] = segment;

    // handle remove tag condition
    if (segment.value === this.removeTagFilterSegment.value) {
      this.segments.splice(index, 3);
      if (this.segments.length === 0) {
        this.segments.push(this.uiSegmentSrv.newPlusButton());
      } else if (this.segments.length > 2) {
        this.segments.splice(Math.max(index - 1, 0), 1);
        if (this.segments[this.segments.length - 1].type !== 'plus-button') {
          this.segments.push(this.uiSegmentSrv.newPlusButton());
        }
      }
    } else {
      if (segment.type === 'plus-button') {
        if (index > 2) {
          this.segments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
        }
        this.segments.push(this.uiSegmentSrv.newOperator('='));
        this.segments.push(this.uiSegmentSrv.newFake('select value', 'value', 'query-segment-value'));
        segment.type = 'key';
        segment.cssClass = 'query-segment-key';
      }

      if (index + 1 === this.segments.length) {
        this.segments.push(this.uiSegmentSrv.newPlusButton());
      }
    }

    this.updateVariableModel();
  }

  updateVariableModel() {
    const filters = [];
    let filterIndex = -1;
    let hasFakes = false;

    this.segments.forEach(segment => {
      if (segment.type === 'value' && segment.fake) {
        hasFakes = true;
        return;
      }

      switch (segment.type) {
        case 'key': {
          filters.push({ key: segment.value });
          filterIndex += 1;
          break;
        }
        case 'value': {
          filters[filterIndex].value = segment.value;
          break;
        }
        case 'operator': {
          filters[filterIndex].operator = segment.value;
          break;
        }
        case 'condition': {
          filters[filterIndex].condition = segment.value;
          break;
        }
      }
    });

    if (hasFakes) {
      return;
    }

    this.variable.setFilters(filters);
    this.variableSrv.variableUpdated(this.variable, true);
  }
}

const template = `
<div class="gf-form-inline">
  <div class="gf-form" ng-repeat="segment in ctrl.segments">
    <metric-segment segment="segment" get-options="ctrl.getOptions(segment, $index)"
                    on-change="ctrl.segmentChanged(segment, $index)"></metric-segment>
  </div>
</div>
`;

export function adHocFiltersComponent() {
  return {
    restrict: 'E',
    template: template,
    controller: AdHocFiltersCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      variable: '=',
      dashboard: '=',
    },
  };
}

coreModule.directive('adHocFilters', adHocFiltersComponent);
