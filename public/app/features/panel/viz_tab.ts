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

  onTypeChanged = (plugin: PanelPlugin) => {};
}

const template = `
<div class="gf-form-group ">
  <div class="gf-form-query">
    <div class="gf-form">
      <label class="gf-form-label">
        <img src="public/app/plugins/panel/graph/img/icn-graph-panel.svg" style="width: 16px; height: 16px" />
        Graph
        <i class="fa fa-caret-down" />
      </label>
		</div>

		<div class="gf-form gf-form--grow">
			<label class="gf-form-label gf-form-label--grow"></label>
		</div>
	</div>

	<br />
	<br />

  <div class="query-editor-rows gf-form-group">
	  <div ng-repeat="tab in ctrl.panelCtrl.optionTabs">
	    <div class="gf-form-query">
		    <div class="gf-form gf-form-query-letter-cell">
			    <label class="gf-form-label">
				    <span class="gf-form-query-letter-cell-carret">
					    <i class="fa fa-caret-down"></i>
				    </span>
				    <span class="gf-form-query-letter-cell-letter">{{tab.title}}</span>
          </label>
			  </div>
        <div class="gf-form gf-form--grow">
			    <label class="gf-form-label gf-form-label--grow"></label>
		    </div>
			</div>
		</div>
	</div>
</div>`;

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
