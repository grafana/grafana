import _ from 'lodash';
import moment from 'moment';
import { coreModule } from 'app/core/core';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import { AnnotationEvent } from '@grafana/ui';

export class EventEditorCtrl {
  panelCtrl: MetricsPanelCtrl;
  event: AnnotationEvent;
  timeRange: { from: number; to: number };
  form: any;
  close: any;
  timeFormated: string;

  /** @ngInject */
  constructor(private annotationsSrv) {
    this.event.panelId = this.panelCtrl.panel.id;
    this.event.dashboardId = this.panelCtrl.dashboard.id;

    // Annotations query returns time as Unix timestamp in milliseconds
    this.event.time = tryEpochToMoment(this.event.time);
    if (this.event.isRegion) {
      this.event.timeEnd = tryEpochToMoment(this.event.timeEnd);
    }

    this.timeFormated = this.panelCtrl.dashboard.formatDate(this.event.time);
  }

  save() {
    if (!this.form.$valid) {
      return;
    }

    const saveModel = _.cloneDeep(this.event);
    saveModel.time = saveModel.time.valueOf();
    saveModel.timeEnd = 0;

    if (saveModel.isRegion) {
      saveModel.timeEnd = this.event.timeEnd.valueOf();

      if (saveModel.timeEnd < saveModel.time) {
        console.log('invalid time');
        return;
      }
    }

    if (saveModel.id) {
      this.annotationsSrv
        .updateAnnotationEvent(saveModel)
        .then(() => {
          this.panelCtrl.refresh();
          this.close();
        })
        .catch(() => {
          this.panelCtrl.refresh();
          this.close();
        });
    } else {
      this.annotationsSrv
        .saveAnnotationEvent(saveModel)
        .then(() => {
          this.panelCtrl.refresh();
          this.close();
        })
        .catch(() => {
          this.panelCtrl.refresh();
          this.close();
        });
    }
  }

  delete() {
    return this.annotationsSrv
      .deleteAnnotationEvent(this.event)
      .then(() => {
        this.panelCtrl.refresh();
        this.close();
      })
      .catch(() => {
        this.panelCtrl.refresh();
        this.close();
      });
  }
}

function tryEpochToMoment(timestamp) {
  if (timestamp && _.isNumber(timestamp)) {
    const epoch = Number(timestamp);
    return moment(epoch);
  } else {
    return timestamp;
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
      panelCtrl: '=',
      event: '=',
      close: '&',
    },
  };
}

coreModule.directive('eventEditor', eventEditor);
