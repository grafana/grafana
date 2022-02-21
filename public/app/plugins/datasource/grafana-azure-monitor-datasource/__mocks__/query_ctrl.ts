export class QueryCtrl {
  target: any;
  datasource: any;
  panelCtrl: any;
  panel: any;
  hasRawMode = false;
  error = '';

  constructor(public $scope: any) {
    this.panelCtrl = this.panelCtrl || { panel: {} };
    this.target = this.target || { target: '' };
    this.panel = this.panelCtrl.panel;
  }

  refresh() {}
}
