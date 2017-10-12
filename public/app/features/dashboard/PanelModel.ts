import {Emitter} from 'app/core/core';

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

const notPersistedProperties: {[str: string]: boolean} = {
  "events": true,
  "fullscreen": true,
  "isEditing": true,
};

export class PanelModel {
  id: number;
  gridPos:  GridPos;
  type: string;
  title: string;
  alert?: any;

  // non persisted
  fullscreen: boolean;
  isEditing: boolean;
  events: Emitter;
  scopedVars: any;

  constructor(model) {
    this.events = new Emitter();

    // copy properties from persisted model
    for (var property in model) {
      this[property] = model[property];
    }
  }

  getSaveModel() {
    const model: any = {};
    for (var property in this) {
      if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
        continue;
      }

      model[property] = this[property];
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
}

