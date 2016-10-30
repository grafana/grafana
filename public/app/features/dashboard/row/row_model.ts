///<reference path="../../../headers/common.d.ts" />

import {Emitter, contextSrv} from 'app/core/core';
import {assignModelProperties} from 'app/core/core';

export class DashboardRow {
  panels: any;
  title: any;
  showTitle: any;
  titleSize: any;
  events: Emitter;

  defaults = {
    title: 'Dashboard Row',
    panels: [],
    showTitle: false,
    titleSize: 'h6',
    height: 250,
    isNew: false,
  };

  constructor(private model) {
    assignModelProperties(this, model, this.defaults);
    this.events = new Emitter();
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }
}

