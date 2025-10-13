import { each, filter, keys } from 'lodash';
import tinycolor from 'tinycolor2';

import { AnnotationEvent } from '@grafana/data';
import {
  ALERTING_COLOR,
  DEFAULT_ANNOTATION_COLOR,
  NO_DATA_COLOR,
  OK_COLOR,
  PENDING_COLOR,
  REGION_FILL_ALPHA,
} from '@grafana/ui';
import { MetricsPanelCtrl } from 'app/angular/panel/metrics_panel_ctrl';

export class EventManager {
  event: AnnotationEvent | null = null;
  editorOpen = false;

  constructor(private panelCtrl: MetricsPanelCtrl) {}

  editorClosed() {
    this.event = null;
    this.editorOpen = false;
    this.panelCtrl.render();
  }

  editorOpened() {
    this.editorOpen = true;
  }

  updateTime(range: { from: any; to: any }) {
    if (!this.event) {
      this.event = {};
      this.event.dashboardUID = this.panelCtrl.dashboard.uid;
      this.event.panelId = this.panelCtrl.panel.id;
    }

    // update time
    this.event.time = range.from;
    this.event.isRegion = false;

    if (range.to) {
      this.event.timeEnd = range.to;
      this.event.isRegion = true;
    }

    this.panelCtrl.render();
  }

  editEvent(event: AnnotationEvent, elem?: any) {
    this.event = event;
    this.panelCtrl.render();
  }

  addFlotEvents(annotations: any, flotOptions: any) {
    if (!this.event && annotations.length === 0) {
      return;
    }

    const types: any = {
      $__alerting: {
        color: ALERTING_COLOR,
        position: 'BOTTOM',
        markerSize: 5,
      },
      $__ok: {
        color: OK_COLOR,
        position: 'BOTTOM',
        markerSize: 5,
      },
      $__no_data: {
        color: NO_DATA_COLOR,
        position: 'BOTTOM',
        markerSize: 5,
      },
      $__pending: {
        color: PENDING_COLOR,
        position: 'BOTTOM',
        markerSize: 5,
      },
      $__editing: {
        color: DEFAULT_ANNOTATION_COLOR,
        position: 'BOTTOM',
        markerSize: 5,
      },
    };

    if (this.event) {
      if (this.event.isRegion) {
        annotations = [
          {
            isRegion: true,
            min: this.event.time,
            timeEnd: this.event.timeEnd,
            text: this.event.text,
            eventType: '$__editing',
            editModel: this.event,
          },
        ];
      } else {
        annotations = [
          {
            min: this.event.time,
            text: this.event.text,
            editModel: this.event,
            eventType: '$__editing',
          },
        ];
      }
    } else {
      // annotations from query
      for (let i = 0; i < annotations.length; i++) {
        const item = annotations[i];

        // add properties used by jquery flot events
        item.min = item.time;
        item.max = item.time;
        item.eventType = item.type;

        if (item.newState) {
          item.eventType = '$__' + item.newState;
          continue;
        }

        if (!types[item.type]) {
          types[item.type] = {
            color: item.color,
            position: 'BOTTOM',
            markerSize: 5,
          };
        }
      }
    }

    const regions = getRegions(annotations);
    addRegionMarking(regions, flotOptions);

    const eventSectionHeight = 20;
    const eventSectionMargin = 7;
    flotOptions.grid.eventSectionHeight = eventSectionMargin;
    flotOptions.xaxis.eventSectionHeight = eventSectionHeight;

    flotOptions.events = {
      levels: keys(types).length + 1,
      data: annotations,
      types: types,
      manager: this,
    };
  }
}

function getRegions(events: AnnotationEvent[]) {
  return filter(events, 'isRegion');
}

function addRegionMarking(regions: any[], flotOptions: { grid: { markings: any } }) {
  const markings = flotOptions.grid.markings;
  const defaultColor = DEFAULT_ANNOTATION_COLOR;
  let fillColor;

  each(regions, (region) => {
    if (region.source) {
      fillColor = region.color || defaultColor;
    } else {
      fillColor = defaultColor;
    }

    fillColor = addAlphaToRGB(fillColor, REGION_FILL_ALPHA);
    markings.push({
      xaxis: { from: region.min, to: region.timeEnd },
      color: fillColor,
    });
  });
}

function addAlphaToRGB(colorString: string, alpha: number): string {
  const color = tinycolor(colorString);
  if (color.isValid()) {
    color.setAlpha(alpha);
    return color.toRgbString();
  } else {
    return colorString;
  }
}
