import _ from 'lodash';
import moment from 'moment';
import {MetricsPanelCtrl} from 'app/plugins/sdk';
import {AnnotationEvent} from './event';

export class EventManager {
  event: AnnotationEvent;

  constructor(private panelCtrl: MetricsPanelCtrl, private elem, private popoverSrv) {
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

  addFlotEvents(annotations, flotOptions) {
    if (!this.event && annotations.length === 0) {
      return;
    }

    var types = {
      '$__alerting': {
        color: 'rgba(237, 46, 24, 1)',
        position: 'BOTTOM',
        markerSize: 5,
      },
      '$__ok': {
        color: 'rgba(11, 237, 50, 1)',
        position: 'BOTTOM',
        markerSize: 5,
      },
      '$__no_data': {
        color: 'rgba(150, 150, 150, 1)',
        position: 'BOTTOM',
        markerSize: 5,
      },
    };

    if (this.event) {
      annotations = [
        {
          min: this.event.time.valueOf(),
          title: this.event.title,
          text: this.event.text,
          eventType: '$__alerting',
        }
      ];
    } else {
      // annotations from query
      for (var i = 0; i < annotations.length; i++) {
        var item = annotations[i];
        if (item.newState) {
          item.eventType = '$__' + item.newState;
          continue;
        }

        if (!types[item.source.name]) {
          types[item.source.name] = {
            color: item.source.iconColor,
            position: 'BOTTOM',
            markerSize: 5,
          };
        }
      }
    }

    flotOptions.events = {
      levels: _.keys(types).length + 1,
      data: annotations,
      types: types,
    };
  }
}
