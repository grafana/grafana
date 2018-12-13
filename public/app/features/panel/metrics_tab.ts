// Libraries
import _ from 'lodash';

// Services & utils
import coreModule from 'app/core/core_module';
import { Emitter } from 'app/core/utils/emitter';

// Types
import { DashboardModel } from '../dashboard/dashboard_model';
import { PanelModel } from '../dashboard/panel_model';
import { DataQuery } from 'app/types';

export interface AngularQueryComponentScope {
  panel: PanelModel;
  dashboard: DashboardModel;
  events: Emitter;
  refresh: () => void;
  render: () => void;
  removeQuery: (query: DataQuery) => void;
  addQuery: (query?: DataQuery) => void;
  moveQuery: (query: DataQuery, direction: number) => void;
}

/** @ngInject */
export function metricsTabDirective() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/features/panel/partials/metrics_tab.html',
  };
}

coreModule.directive('metricsTab', metricsTabDirective);
