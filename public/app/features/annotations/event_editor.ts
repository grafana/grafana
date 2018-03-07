///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import {coreModule} from 'app/core/core';
import {MetricsPanelCtrl} from 'app/plugins/sdk';
import {AnnotationEvent} from './event';

export class EventEditorCtrl {
  panelCtrl: MetricsPanelCtrl;
  event: AnnotationEvent;
  timeRange: {from: number, to: number};
  form: any;
  close: any;

  /** @ngInject **/
  constructor(private annotationsSrv) {
    this.event.panelId = this.panelCtrl.panel.id;
    this.event.dashboardId = this.panelCtrl.dashboard.id;
  }

  save() {
    if (!this.form.$valid) {
      return;
    }

    let saveModel = _.cloneDeep(this.event);
    saveModel.time = saveModel.time.valueOf();
    saveModel.timeEnd = 0;

    if (saveModel.isRegion) {
      saveModel.timeEnd = saveModel.timeEnd.valueOf();

      if (saveModel.timeEnd < saveModel.time) {
        console.log('invalid time');
        return;
      }
    }

    this.annotationsSrv.saveAnnotationEvent(saveModel).then(() => {
      this.panelCtrl.refresh();
      this.close();
    });
  }

  timeChanged() {
    this.panelCtrl.render();
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
      "event": "=",
      "close": "&",
    }
  };
}

coreModule.directive('eventEditor', eventEditor);
