///<reference path="../../../headers/common.d.ts" />
import _ from 'lodash';
import $ from 'jquery';
import d3 from 'd3';
import {contextSrv} from 'app/core/core';

const COLOR_LEGEND_SELECTOR = '.heatmap-color-legend';

export class HeatmapDisplayEditorCtrl {
  panel: any;
  panelCtrl: any;

  /** @ngInject */
  constructor($scope) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;

    this.panelCtrl.render();
  }
}

/** @ngInject */
export function heatmapDisplayEditor() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/plugins/panel/heatmap/partials/display_editor.html',
    controller: HeatmapDisplayEditorCtrl,
  };
}
