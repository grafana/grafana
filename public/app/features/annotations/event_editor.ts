///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import coreModule from 'app/core/core_module';
import {MetricsPanelCtrl} from 'app/plugins/sdk';

export class AnnotationEvent {
  dashboardId: number;
  panelId: number;
  time: any;
  timeEnd: any;
  isRegion: boolean;
  title: string;
  text: string;
}

export class EventEditorCtrl {
  panelCtrl: MetricsPanelCtrl;
  annotation: AnnotationEvent;
  timeRange: {from: number, to: number};
  form: any;

  /** @ngInject **/
  constructor(private annotationsSrv) {
    this.annotation = new AnnotationEvent();
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

    let saveModel = _.cloneDeep(this.annotation);
    saveModel.time = saveModel.time.valueOf();
    if (saveModel.isRegion) {
      saveModel.timeEnd = saveModel.timeEnd.valueOf();
    }

    if (saveModel.timeEnd < saveModel.time) {
      console.log('invalid time');
      return;
    }

    this.annotationsSrv.saveAnnotationEvent(saveModel);
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
      "timeRange": "=",
      "cancel": "&",
    }
  };
}

coreModule.directive('eventEditor', eventEditor);
