///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';

var template = `
<div class="graph-legend-popover">
  <div ng-show="ctrl.series" class="p-b-1">
    <label>Y Axis:</label>
    <button ng-click="ctrl.toggleAxis(yaxis);" class="btn btn-small"
            ng-class="{'btn-success': ctrl.series.yaxis === 1,
                       'btn-inverse': ctrl.series.yaxis === 2}">
      Left
    </button>
    <button ng-click="ctrl.toggleAxis(yaxis);"
      class="btn btn-small"
      ng-class="{'btn-success': ctrl.series.yaxis === 2,
                 'btn-inverse': ctrl.series.yaxis === 1}">
      Right
    </button>
  </div>

  <p class="m-b-0">
   <i ng-repeat="color in ctrl.colors" class="pointer fa fa-circle"
    ng-style="{color:color}"
    ng-click="ctrl.colorSelected(color);">&nbsp;</i>
  </p>
</div>
`;

export class ColorPickerCtrl {
  colors: any;
  autoClose: boolean;
  series: any;
  showAxisControls: boolean;

  /** @ngInject */
  constructor(private $scope, private $rootScope) {
    this.colors = $rootScope.colors;
    this.autoClose = $scope.autoClose;
    this.series = $scope.series;
  }

  toggleAxis(yaxis) {
    this.$scope.toggleAxis();

    if (this.$scope.autoClose) {
      this.$scope.dismiss();
    }
  }

  colorSelected(color) {
    this.$scope.colorSelected(color);
    if (this.$scope.autoClose) {
      this.$scope.dismiss();
    }
  }
}

export function colorPicker() {
  return {
    restrict: 'E',
    controller: ColorPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    template: template,
  };
}

coreModule.directive('gfColorPicker', colorPicker);
