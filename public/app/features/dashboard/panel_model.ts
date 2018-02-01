import { Emitter } from 'app/core/utils/emitter';
import _ from 'lodash';

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}

const notPersistedProperties: { [str: string]: boolean } = {
  events: true,
  fullscreen: true,
  isEditing: true,
};

export class PanelModel {
  id: number;
  gridPos: GridPos;
  type: string;
  title: string;
  alert?: any;
  scopedVars?: any;
  repeat?: string;
  repeatIteration?: number;
  repeatPanelId?: number;
  repeatDirection?: string;
  repeatedByRow?: boolean;
  minSpan?: number;
  collapsed?: boolean;
  panels?: any;
  soloMode?: boolean;

  // non persisted
  fullscreen: boolean;
  isEditing: boolean;
  events: Emitter;

  constructor(model) {
    this.events = new Emitter();

    // copy properties from persisted model
    for (var property in model) {
      this[property] = model[property];
    }

    if (!this.gridPos) {
      this.gridPos = { x: 0, y: 0, h: 3, w: 6 };
    }
  }

  getSaveModel() {
    const model: any = {};
    for (var property in this) {
      if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
        continue;
      }

      model[property] = _.cloneDeep(this[property]);
    }

    return model;
  }

  setViewMode(fullscreen: boolean, isEditing: boolean) {
    this.fullscreen = fullscreen;
    this.isEditing = isEditing;
    this.events.emit('panel-size-changed');
  }

  updateGridPos(newPos: GridPos) {
    let sizeChanged = false;

    if (this.gridPos.w !== newPos.w || this.gridPos.h !== newPos.h) {
      sizeChanged = true;
    }

    this.gridPos.x = newPos.x;
    this.gridPos.y = newPos.y;
    this.gridPos.w = newPos.w;
    this.gridPos.h = newPos.h;

    if (sizeChanged) {
      console.log('PanelModel sizeChanged event and render events fired');
      this.events.emit('panel-size-changed');
    }
  }

  resizeDone() {
    this.events.emit('panel-size-changed');
  }

  destroy() {
    this.events.removeAllListeners();
  }
}
