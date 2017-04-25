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
      if (this.event.isRegion) {
        annotations = [
          {
            regionId: 1,
            min: this.event.time.valueOf(),
            title: this.event.title,
            text: this.event.text,
            eventType: '$__alerting',
            source: {
              iconColor: 'rgba(237, 46, 24, 1)',
            }
          },
          {
            regionId: 1,
            min: this.event.timeEnd.valueOf()
          }
        ];
      } else {
        annotations = [
          {
            min: this.event.time.valueOf(),
            title: this.event.title,
            text: this.event.text,
            eventType: '$__alerting',
          }
        ];
      }
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
            icon: item.source.icon,
            emoji: item.source.emoji,
            position: 'BOTTOM',
            markerSize: 5,
          };
        }
      }
    }

    let regions = buildRegions(annotations);
    addRegionMarking(regions, flotOptions);

    flotOptions.events = {
      levels: _.keys(types).length + 1,
      data: annotations,
      types: types,
    };
  }
}

export function buildRegions(events) {
  var region_events = _.filter(events, function (event) {
    return event.regionId;
  });
  var regions = _.groupBy(region_events, 'regionId');
  regions = _.compact(_.map(regions, function (region_events) {
    if (region_events && region_events.length > 1) {
      var region_obj = region_events[0];
      region_obj.timeEnd = region_events[1].min;
      region_obj.isRegion = true;
      return region_obj;
    }
  }));

  return regions;
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

function addAlphaToRGB(rgb, alpha) {
  let rgbPattern = /^rgb\(/;
  if (rgbPattern.test(rgb)) {
    return rgb.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  } else {
    return rgb.replace(/[\d\.]+\)/, `${alpha})`);
  }
}

function convertToRGB(hex) {
  let hexPattern = /#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})/g;
  let match = hexPattern.exec(hex);
  if (match) {
    let rgb = _.map(match.slice(1), hex_val => {
      return parseInt(hex_val, 16);
    });
    return 'rgb(' + rgb.join(',')  + ')';
  } else {
    return null;
  }
}
