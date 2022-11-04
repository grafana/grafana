export class HeatmapDisplayEditorCtrl {
  panel: any;
  panelCtrl: any;

  static $inject = ['$scope'];

  constructor($scope: any) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
  }
}

export function heatmapDisplayEditor() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/plugins/panel/heatmap/partials/display_editor.html',
    controller: HeatmapDisplayEditorCtrl,
  };
}
