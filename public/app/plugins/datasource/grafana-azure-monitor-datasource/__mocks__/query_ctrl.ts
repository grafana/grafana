export class QueryCtrl {
  target: any;
  datasource: any;
  panelCtrl: any;
  panel: any;
  hasRawMode: boolean;
  error: string;

  constructor(public $scope, _$injector) {
    this.panelCtrl = this.panelCtrl || { panel: {} };
    this.target = this.target || { target: '' };
    this.panel = this.panelCtrl.panel;
  }

  refresh() {}
}
