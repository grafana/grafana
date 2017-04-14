///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import {coreModule} from 'app/core/core';
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

export class EventManager {
  event: AnnotationEvent;

  constructor(private panelCtrl: MetricsPanelCtrl,
              private elem,
              private popoverSrv) {
              }

              editorClosed() {
                console.log('editorClosed');
                this.event = null;
                this.panelCtrl.render();
              }

              updateTime(range) {
                let newEvent = true;

                if (this.event) {
                  newEvent = false;
                } else {
                  // init new event
                  this.event = new AnnotationEvent();
                  this.event.dashboardId = this.panelCtrl.dashboard.id;
                  this.event.panelId = this.panelCtrl.panel.id;
                }

                // update time
                this.event.time = moment(range.from);
                this.event.isRegion = false;
                if (range.to) {
                  this.event.timeEnd = moment(range.to);
                  this.event.isRegion = true;
                }

                // newEvent means the editor is not visible
                if (!newEvent) {
                  this.panelCtrl.render();
                  return;
                }

                this.popoverSrv.show({
                  element: this.elem[0],
                  classNames: 'drop-popover drop-popover--form',
                  position: 'bottom center',
                  openOn: null,
                  template: '<event-editor panel-ctrl="panelCtrl" event="event" close="dismiss()"></event-editor>',
                  onClose: this.editorClosed.bind(this),
                  model: {
                    event: this.event,
                    panelCtrl: this.panelCtrl,
                  },
                });

                this.panelCtrl.render();
              }
}

