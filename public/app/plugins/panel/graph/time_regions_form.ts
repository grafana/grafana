import coreModule from 'app/angular/core_module';

import { getColorModes } from './time_region_manager';

export class TimeRegionFormCtrl {
  panelCtrl: any;
  panel: any;
  disabled = false;
  colorModes: any;

  static $inject = ['$scope'];

  constructor(private $scope: any) {}

  $onInit() {
    this.panel = this.panelCtrl.panel;

    const unbindDestroy = this.$scope.$on('$destroy', () => {
      this.panelCtrl.editingTimeRegions = false;
      this.panelCtrl.render();
      unbindDestroy();
    });

    this.colorModes = getColorModes();
    this.panelCtrl.editingTimeRegions = true;
  }

  render() {
    this.panelCtrl.render();
  }

  addTimeRegion() {
    this.panel.timeRegions.push({
      op: 'time',
      fromDayOfWeek: undefined,
      from: undefined,
      toDayOfWeek: undefined,
      to: undefined,
      colorMode: 'background6',
      fill: true,
      line: false,
      // Default colors for new
      fillColor: 'rgba(234, 112, 112, 0.12)',
      lineColor: 'rgba(237, 46, 24, 0.60)',
    });
    this.panelCtrl.render();
  }

  removeTimeRegion(index: number) {
    this.panel.timeRegions.splice(index, 1);
    this.panelCtrl.render();
  }

  onFillColorChange(index: number) {
    return (newColor: string) => {
      this.panel.timeRegions[index].fillColor = newColor;
      this.render();
    };
  }

  onLineColorChange(index: number) {
    return (newColor: string) => {
      this.panel.timeRegions[index].lineColor = newColor;
      this.render();
    };
  }
}

coreModule.directive('graphTimeRegionForm', () => {
  return {
    restrict: 'E',
    templateUrl: 'public/app/plugins/panel/graph/time_regions_form.html',
    controller: TimeRegionFormCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      panelCtrl: '=',
    },
  };
});
