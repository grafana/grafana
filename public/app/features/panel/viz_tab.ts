import coreModule from 'app/core/core_module';
import { DashboardModel } from '../dashboard/dashboard_model';
import { VizTypePicker } from '../dashboard/dashgrid/VizTypePicker';
import { react2AngularDirective } from 'app/core/utils/react2angular';
import { PanelPlugin } from 'app/types/plugins';

export class VizTabCtrl {
  panelCtrl: any;
  dashboard: DashboardModel;

  /** @ngInject */
  constructor($scope) {
    this.panelCtrl = $scope.ctrl;
    this.dashboard = this.panelCtrl.dashboard;

    $scope.ctrl = this;
  }

  onTypeChanged = (plugin: PanelPlugin) => {
    this.dashboard.changePanelType(this.panelCtrl.panel, plugin.id);
  };
}

const template = `
<div class="viz-editor">
  <div class="viz-editor-col1">
    <viz-type-picker currentType="ctrl.panelCtrl.panel.type" onTypeChanged="ctrl.onTypeChanged"></viz-type-picker>
  </div>
  <div class="viz-editor-col2">
    <div ng-repeat="tab in ctrl.panelCtrl.optionTabs" >
      <h5 class="page-heading">{{tab.title}}</h5>
      <panel-editor-tab editor-tab="tab" ctrl="ctrl.panelCtrl" index="$index"></panel-editor-tab>
    </div>
  </div>
</div>
`;

/** @ngInject */
export function vizTabDirective() {
  'use strict';
  return {
    restrict: 'E',
    template: template,
    controller: VizTabCtrl,
  };
}

react2AngularDirective('vizTypePicker', VizTypePicker, ['currentType', ['onTypeChanged', { watchDepth: 'reference' }]]);

coreModule.directive('vizTab', vizTabDirective);
