import angular from 'angular';
import _ from 'lodash';

export class DimensionsFilterCtrl {
  target: any;
  defaultFilter: any;
  refresh: () => void;

  shouldDisplayAddButton() {
    const { queryMode, data } = this.target.azureMonitor;
    const filtersLength = data[queryMode].dimensionFilters.length;
    const lastItem = data[queryMode].dimensionFilters[filtersLength - 1];

    return lastItem ? lastItem.filter && lastItem.dimension && lastItem.dimension !== 'None' : true;
  }

  shouldDisplayCondition(index: number) {
    const { queryMode, data } = this.target.azureMonitor;
    const filtersLength = data[queryMode].dimensionFilters.length;
    return filtersLength && filtersLength > 1 && filtersLength !== index + 1;
  }

  onAdd() {
    const { queryMode } = this.target.azureMonitor;
    this.target.azureMonitor.data[queryMode].dimensionFilters.push({ ...this.defaultFilter });
  }

  onRemove(index: number) {
    const { queryMode } = this.target.azureMonitor;
    this.target.azureMonitor.data[queryMode].dimensionFilters.splice(index, 1);
    this.refresh();
  }
}

export function dimensionsFilter() {
  return {
    scope: { target: '=', defaultFilter: '=', refresh: '&' },
    templateUrl:
      'public/app/plugins/datasource/grafana-azure-monitor-datasource/partials/dimensions-filter.directive.html',
    controller: DimensionsFilterCtrl,
    controllerAs: 'vm',
    bindToController: true,
  };
}

angular.module('grafana.directives').directive('dimensionsFilter', dimensionsFilter);
