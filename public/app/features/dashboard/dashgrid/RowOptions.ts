import {coreModule} from 'app/core/core';

export class RowOptionsCtrl {
  row: any;
  source: any;
  dismiss: any;
  onUpdated: any;
  onDelete: any;
  showDelete: boolean;

  /** @ngInject */
  constructor() {
    this.source = this.row;
    this.row = this.row.getSaveModel();
  }

  update() {
    this.source.title = this.row.title;
    this.source.repeat = this.row.repeat;
    this.onUpdated();
    this.dismiss();
  }

  delete() {
    this.onDelete();
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
      row: "=",
      dismiss: "&",
      onUpdated: "&",
      onDelete: "&"
    },
  };
}

coreModule.directive('rowOptions', rowOptionsDirective);
