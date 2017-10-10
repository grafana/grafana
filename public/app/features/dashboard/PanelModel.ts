import {Emitter} from 'app/core/core';

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

const notPersistedProperties: {[str: string]: boolean} = {
  "model": true,
  "events": true,
};

export class PanelModel {
  id: number;
  gridPos:  GridPos;
  type: string;
  title: string;
  events: Emitter;

  constructor(private model) {
    // copy properties from persisted model
    for (var property in model) {
      this[property] = model[property];
    }

    this.events = new Emitter();
  }

  getSaveModel() {
    this.model = {};
    for (var property in this) {
      if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
        console.log('PanelModel.getSaveModel() skiping property', property);
        continue;
      }

      this.model[property] = this[property];
    }
    return this.model;
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
}

