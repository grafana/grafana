///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import coreModule from 'app/core/core_module';
import {MetricsPanelCtrl} from 'app/plugins/sdk';

export class AnnotationItem {
  dashboardId: number;
  panelId: number;
  time: Date;
  timeEnd: Date;
  isRegion: boolean;
  title: string;
  text: string;
}

export class EventEditorCtrl {
  panelCtrl: MetricsPanelCtrl;
  timeFormat = 'YYYY-MM-DD HH:mm:ss';
  annotation: AnnotationItem;
  timeRange: {from: number, to: number};
  form: any;

  /** @ngInject **/
  constructor() {
    this.annotation = new AnnotationItem();
    this.annotation.panelId = this.panelCtrl.panel.id;
    this.annotation.dashboardId = this.panelCtrl.dashboard.id;
    this.annotation.text = "hello";

    this.annotation.time = moment(this.timeRange.from);
    if (this.timeRange.to) {
      this.annotation.timeEnd = moment(this.timeRange.to);
      this.annotation.isRegion = true;
    }
  }

  save() {
    if (!this.form.$valid) {
      return;
    }
  }
}

export function eventEditor() {
  return {
    restrict: 'E',
    controller: EventEditorCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    templateUrl: 'public/app/features/annotations/partials/event_editor.html',
    scope: {
      "panelCtrl": "=",
      "timeRange": "="
    }
  };
}

coreModule.directive('eventEditor', eventEditor);
