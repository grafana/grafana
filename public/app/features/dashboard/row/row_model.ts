///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import {Emitter, contextSrv} from 'app/core/core';
import {assignModelProperties} from 'app/core/core';

export class DashboardRow {
  panels: any;
  title: any;
  showTitle: any;
  titleSize: any;
  events: Emitter;
  span: number;

  defaults = {
    title: 'Dashboard Row',
    panels: [],
    showTitle: false,
    titleSize: 'h6',
    height: 250,
    isNew: false,
  };

  constructor(private model) {
    console.log(model.isNew);
    assignModelProperties(this, model, this.defaults);
    this.events = new Emitter();
    this.updateRowSpan();
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  updateRowSpan() {
    this.span = 0;
    for (let panel of this.panels) {
      this.span += panel.span;
    }
  }

  panelSpanChanged() {
    var oldSpan = this.span;
    this.updateRowSpan();

    if (oldSpan !== this.span) {
      this.events.emit('span-changed');
    }
  }

  addPanel(panel) {
    var rowSpan = this.span;
    var panelCount = this.panels.length;
    var space = (12 - rowSpan) - panel.span;

    // try to make room of there is no space left
    if (space <= 0) {
      if (panelCount === 1) {
        this.panels[0].span = 6;
        panel.span = 6;
      } else if (panelCount === 2) {
        this.panels[0].span = 4;
        this.panels[1].span = 4;
        panel.span = 4;
      }
    }

    this.panels.push(panel);
    this.events.emit('panel-added', panel);
    this.panelSpanChanged();
  }

  removePanel(panel) {
    var index = _.indexOf(this.panels, panel);
    this.panels.splice(index, 1);

    this.events.emit('panel-removed', panel);
    this.panelSpanChanged();
  }
}

