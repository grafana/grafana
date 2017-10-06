import _ from 'lodash';
import moment from 'moment';
import {MetricsPanelCtrl} from 'app/plugins/sdk';
import {AnnotationEvent} from './event';

const OK_COLOR =       "rgba(11, 237, 50, 1)",
      ALERTING_COLOR = "rgba(237, 46, 24, 1)",
      NO_DATA_COLOR =  "rgba(150, 150, 150, 1)";


export class EventManager {
  event: AnnotationEvent;

  constructor(private panelCtrl: MetricsPanelCtrl, private elem, private popoverSrv) {
  }

  editorClosed() {
    this.event = null;
    this.panelCtrl.render();
  }

  updateTime(range) {
    if (this.event) {
      // means the editor is not visible
      this.panelCtrl.render();
      return;
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

  editEvent(event, elem?) {
    this.event = event;
    let element = elem ? this.elem.find(elem) : this.elem;
    this.popoverSrv.show({
      element: element[0],
      classNames: 'drop-popover drop-popover--form',
      position: 'bottom center',
      openOn: null,
      template: '<event-editor panel-ctrl="panelCtrl" event="event" close="dismiss()"></event-editor>',
      onClose: this.editorClosed.bind(this),
      model: {
        event: event,
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
        color: ALERTING_COLOR,
        position: 'BOTTOM',
        markerSize: 5,
      },
      '$__ok': {
        color: OK_COLOR,
        position: 'BOTTOM',
        markerSize: 5,
      },
      '$__no_data': {
        color: NO_DATA_COLOR,
        position: 'BOTTOM',
        markerSize: 5,
      },
    };

    if (this.event) {
      if (this.event.isRegion) {
        annotations = [
          {
            isRegion: true,
            min: this.event.time.valueOf(),
            timeEnd: this.event.timeEnd.valueOf(),
            title: this.event.title,
            text: this.event.text,
            eventType: '$__alerting',
            source: {
              iconColor: ALERTING_COLOR,
            }
          }
        ];
      } else {
        annotations = [
          {
            min: this.event.time.valueOf(),
            title: this.event.title,
            text: this.event.text,
            eventType: '$__alerting'
          }
        ];
      }
    } else {
      // annotations from query
      for (var i = 0; i < annotations.length; i++) {
        var item = annotations[i];

        // add properties used by jquery flot events
        item.min = item.time;
        item.max = item.time;
        item.eventType = item.source.name;

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

    let regions = getRegions(annotations);
    addRegionMarking(regions, flotOptions);

    let eventSectionHeight = 20;
    let eventSectionMargin = 7;
    flotOptions.grid.eventSectionHeight = eventSectionMargin;
    flotOptions.xaxis.eventSectionHeight = eventSectionHeight;

    flotOptions.events = {
      levels: _.keys(types).length + 1,
      data: annotations,
      types: types,
    };
  }
}

function getRegions(events) {
  return _.filter(events, 'isRegion');
}

function addRegionMarking(regions, flotOptions) {
  let markings = flotOptions.grid.markings;
  let defaultColor = 'rgb(237, 46, 24)';
  let fillColor;

  _.each(regions, region => {
    if (region.source) {
      fillColor = region.source.iconColor || defaultColor;
    } else {
      fillColor = defaultColor;
    }

    // Convert #FFFFFF to rgb(255, 255, 255)
    // because panels with alerting use this format
    let hexPattern = /^#[\da-fA-f]{3,6}/;
    if (hexPattern.test(fillColor)) {
      fillColor = convertToRGB(fillColor);
    }

    fillColor = addAlphaToRGB(fillColor, 0.090);
    markings.push({ xaxis: { from: region.min, to: region.timeEnd }, color: fillColor });
  });
}

function addAlphaToRGB(rgb: string, alpha: number): string {
  let rgbPattern = /^rgb\(/;
  if (rgbPattern.test(rgb)) {
    return rgb.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  } else {
    return rgb.replace(/[\d\.]+\)/, `${alpha})`);
  }
}

function convertToRGB(hex: string): string {
  let hexPattern = /#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})/g;
  let match = hexPattern.exec(hex);
  if (match) {
    let rgb = _.map(match.slice(1), hex_val => {
      return parseInt(hex_val, 16);
    });
    return 'rgb(' + rgb.join(',')  + ')';
  } else {
    return "";
  }
}
