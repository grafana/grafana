import { coreModule } from 'app/core/core';

export class RowOptionsCtrl {
  row: any;
  dashboard: any;
  source: any;
  dismiss: any;
  onUpdated: any;
  showDelete: boolean;
  repeat: string;

  /** @ngInject */
  constructor() {
    this.source = this.row;
    this.row = this.row.getSaveModel();
    this.repeat = this.source.repeat;
  }

  update() {
    this.source.title = this.row.title;
    this.source.repeat = this.row.repeat;
    if (this.source.repeat || this.repeat) {
      this.dashboard.processRepeats(false);
    }
    this.onUpdated();
    this.dismiss();
  }
}

export function rowOptionsDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/partials/row_options.html',
    controller: RowOptionsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      row: '=',
      dashboard: '=',
      dismiss: '&',
      onUpdated: '&',
    },
  };
}

coreModule.directive('rowOptions', rowOptionsDirective);
