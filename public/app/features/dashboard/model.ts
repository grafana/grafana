///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import angular from 'angular';
import moment from 'moment';
import _ from 'lodash';
import $ from 'jquery';

import {Emitter, contextSrv, appEvents} from 'app/core/core';
import {DashboardRow} from './row/row_model';
import sortByKeys from 'app/core/utils/sort_by_keys';

export class DashboardModel {
  id: any;
  title: any;
  autoUpdate: any;
  description: any;
  tags: any;
  style: any;
  timezone: any;
  editable: any;
  graphTooltip: any;
  rows: DashboardRow[];
  time: any;
  timepicker: any;
  hideControls: any;
  templating: any;
  annotations: any;
  refresh: any;
  snapshot: any;
  schemaVersion: number;
  version: number;
  revision: number;
  links: any;
  gnetId: any;
  meta: any;
  events: any;
  editMode: boolean;

  constructor(data, meta?) {
    if (!data) {
      data = {};
    }

    this.events = new Emitter();
    this.id = data.id || null;
    this.revision = data.revision;
    this.title = data.title || 'No Title';
    this.autoUpdate = data.autoUpdate;
    this.description = data.description;
    this.tags = data.tags || [];
    this.style = data.style || "dark";
    this.timezone = data.timezone || '';
    this.editable = data.editable !== false;
    this.graphTooltip = data.graphTooltip || 0;
    this.hideControls = data.hideControls || false;
    this.time = data.time || { from: 'now-6h', to: 'now' };
    this.timepicker = data.timepicker || {};
    this.templating = this.ensureListExist(data.templating);
    this.annotations = this.ensureListExist(data.annotations);
    this.refresh = data.refresh;
    this.snapshot = data.snapshot;
    this.schemaVersion = data.schemaVersion || 0;
    this.version = data.version || 0;
    this.links = data.links || [];
    this.gnetId = data.gnetId || null;

    this.rows = [];
    if (data.rows) {
      for (let row of data.rows) {
        this.rows.push(new DashboardRow(row));
      }
    }

    this.updateSchema(data);
    this.initMeta(meta);
  }

  private initMeta(meta) {
    meta = meta || {};

    meta.canShare = meta.canShare !== false;
    meta.canSave = meta.canSave !== false;
    meta.canStar = meta.canStar !== false;
    meta.canEdit = meta.canEdit !== false;

    if (!this.editable) {
      meta.canEdit = false;
      meta.canDelete = false;
      meta.canSave = false;
    }

    this.meta = meta;
  }

  // cleans meta data and other non peristent state
  getSaveModelClone() {
    // temp remove stuff
    var events = this.events;
    var meta = this.meta;
    var rows = this.rows;
    var variables = this.templating.list;

    delete this.events;
    delete this.meta;

    // prepare save model
    this.rows = _.map(rows, row => row.getSaveModel());
    this.templating.list = _.map(variables, variable => variable.getSaveModel ? variable.getSaveModel() : variable);

    // make clone
    var copy = $.extend(true, {}, this);
    //  sort clone
    copy = sortByKeys(copy);

    // restore properties
    this.events = events;
    this.meta = meta;
    this.rows = rows;
    this.templating.list = variables;

    return copy;
  }

  addEmptyRow() {
    this.rows.push(new DashboardRow({isNew: true}));
  }

  private ensureListExist(data) {
    if (!data) { data = {}; }
    if (!data.list) { data.list = []; }
    return data;
  }

  getNextPanelId() {
    var i, j, row, panel, max = 0;
    for (i = 0; i < this.rows.length; i++) {
      row = this.rows[i];
      for (j = 0; j < row.panels.length; j++) {
        panel = row.panels[j];
        if (panel.id > max) { max = panel.id; }
      }
    }
    return max + 1;
  }

  forEachPanel(callback) {
    var i, j, row;
    for (i = 0; i < this.rows.length; i++) {
      row = this.rows[i];
      for (j = 0; j < row.panels.length; j++) {
        callback(row.panels[j], j, row, i);
      }
    }
  }

  getPanelById(id) {
    for (var i = 0; i < this.rows.length; i++) {
      var row = this.rows[i];
      for (var j = 0; j < row.panels.length; j++) {
        var panel = row.panels[j];
        if (panel.id === id) {
          return panel;
        }
      }
    }
    return null;
  }

  addPanel(panel, row) {
    panel.id = this.getNextPanelId();
    row.addPanel(panel);
  }

  removeRow(row, force?) {
    var index = _.indexOf(this.rows, row);

    if (!row.panels.length || force) {
      this.rows.splice(index, 1);
      row.destroy();
      return;
    }

    appEvents.emit('confirm-modal', {
      title: 'Remove Row',
      text: 'Are you sure you want to remove this row?',
      icon: 'fa-trash',
      yesText: 'Delete',
      onConfirm: () => {
        this.rows.splice(index, 1);
        row.destroy();
      }
    });
  }

  setPanelFocus(id) {
    this.meta.focusPanelId = id;
  }

  updateSubmenuVisibility() {
    this.meta.submenuEnabled = (() => {
      if (this.links.length > 0) { return true; }

      var visibleVars = _.filter(this.templating.list, variable => variable.hide !== 2);
      if (visibleVars.length > 0) { return true; }

      var visibleAnnotations = _.filter(this.annotations.list, annotation => annotation.hide !== true);
      if (visibleAnnotations.length > 0) { return true; }

      return false;
    })();
  }

  getPanelInfoById(panelId) {
    var result: any = {};
    _.each(this.rows, function(row) {
      _.each(row.panels, function(panel, index) {
        if (panel.id === panelId) {
          result.panel = panel;
          result.row = row;
          result.index = index;
        }
      });
    });

    if (!result.panel) {
      return null;
    }

    return result;
  }

  duplicatePanel(panel, row) {
    var newPanel = angular.copy(panel);
    newPanel.id = this.getNextPanelId();

    delete newPanel.repeat;
    delete newPanel.repeatIteration;
    delete newPanel.repeatPanelId;
    delete newPanel.scopedVars;
    delete newPanel.alert;

    row.addPanel(newPanel);
    return newPanel;
  }

  formatDate(date, format?) {
    date = moment.isMoment(date) ? date : moment(date);
    format = format || 'YYYY-MM-DD HH:mm:ss';
    let timezone = this.getTimezone();

    return timezone === 'browser' ?
      moment(date).format(format) :
      moment.utc(date).format(format);
  }

  destroy() {
    this.events.removeAllListeners();
    for (let row of this.rows) {
      row.destroy();
    }
  }

  cycleGraphTooltip() {
    this.graphTooltip = (this.graphTooltip + 1) % 3;
  }

  sharedTooltipModeEnabled() {
    return this.graphTooltip > 0;
  }

  sharedCrosshairModeOnly() {
    return this.graphTooltip === 1;
  }

  getRelativeTime(date) {
    date = moment.isMoment(date) ? date : moment(date);

    return this.timezone === 'browser' ?
      moment(date).fromNow() :
      moment.utc(date).fromNow();
  }

  getNextQueryLetter(panel) {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    return _.find(letters, function(refId) {
      return _.every(panel.targets, function(other) {
        return other.refId !== refId;
      });
    });
  }

  isTimezoneUtc() {
    return this.getTimezone() === 'utc';
  }

  getTimezone() {
    return this.timezone ? this.timezone : contextSrv.user.timezone;
  }

  private updateSchema(old) {
    var i, j, k;
    var oldVersion = this.schemaVersion;
    var panelUpgrades = [];
    this.schemaVersion = 14;

    if (oldVersion === this.schemaVersion) {
      return;
    }

    // version 2 schema changes
    if (oldVersion < 2) {

      if (old.services) {
        if (old.services.filter) {
          this.time = old.services.filter.time;
          this.templating.list = old.services.filter.list || [];
        }
      }

      panelUpgrades.push(function(panel) {
        // rename panel type
        if (panel.type === 'graphite') {
          panel.type = 'graph';
        }

        if (panel.type !== 'graph') {
          return;
        }

        if (_.isBoolean(panel.legend)) { panel.legend = { show: panel.legend }; }

        if (panel.grid) {
          if (panel.grid.min) {
            panel.grid.leftMin = panel.grid.min;
            delete panel.grid.min;
          }

          if (panel.grid.max) {
            panel.grid.leftMax = panel.grid.max;
            delete panel.grid.max;
          }
        }

        if (panel.y_format) {
          panel.y_formats[0] = panel.y_format;
          delete panel.y_format;
        }

        if (panel.y2_format) {
          panel.y_formats[1] = panel.y2_format;
          delete panel.y2_format;
        }
      });
    }

    // schema version 3 changes
    if (oldVersion < 3) {
      // ensure panel ids
      var maxId = this.getNextPanelId();
      panelUpgrades.push(function(panel) {
        if (!panel.id) {
          panel.id = maxId;
          maxId += 1;
        }
      });
    }

    // schema version 4 changes
    if (oldVersion < 4) {
      // move aliasYAxis changes
      panelUpgrades.push(function(panel) {
        if (panel.type !== 'graph') { return; }
        _.each(panel.aliasYAxis, function(value, key) {
          panel.seriesOverrides = [{ alias: key, yaxis: value }];
        });
        delete panel.aliasYAxis;
      });
    }

    if (oldVersion < 6) {
      // move pulldowns to new schema
      var annotations = _.find(old.pulldowns, { type: 'annotations' });

      if (annotations) {
        this.annotations = {
          list: annotations.annotations || [],
        };
      }

      // update template variables
      for (i = 0 ; i < this.templating.list.length; i++) {
        var variable = this.templating.list[i];
        if (variable.datasource === void 0) { variable.datasource = null; }
        if (variable.type === 'filter') { variable.type = 'query'; }
        if (variable.type === void 0) { variable.type = 'query'; }
        if (variable.allFormat === void 0) { variable.allFormat = 'glob'; }
      }
    }

    if (oldVersion < 7) {
      if (old.nav && old.nav.length) {
        this.timepicker = old.nav[0];
      }

      // ensure query refIds
      panelUpgrades.push(function(panel) {
        _.each(panel.targets, function(target) {
          if (!target.refId) {
            target.refId = this.getNextQueryLetter(panel);
            }
          }.bind(this));
        });
      }

      if (oldVersion < 8) {
        panelUpgrades.push(function(panel) {
          _.each(panel.targets, function(target) {
            // update old influxdb query schema
            if (target.fields && target.tags && target.groupBy) {
              if (target.rawQuery) {
                delete target.fields;
                delete target.fill;
              } else {
                target.select = _.map(target.fields, function(field) {
                  var parts = [];
                  parts.push({type: 'field', params: [field.name]});
                  parts.push({type: field.func, params: []});
                  if (field.mathExpr) {
                    parts.push({type: 'math', params: [field.mathExpr]});
                  }
                  if (field.asExpr) {
                    parts.push({type: 'alias', params: [field.asExpr]});
                  }
                  return parts;
                });
                delete target.fields;
                _.each(target.groupBy, function(part) {
                  if (part.type === 'time' && part.interval)  {
                    part.params = [part.interval];
                    delete part.interval;
                  }
                  if (part.type === 'tag' && part.key) {
                    part.params = [part.key];
                    delete part.key;
                  }
                });

                if (target.fill) {
                  target.groupBy.push({type: 'fill', params: [target.fill]});
                  delete target.fill;
                }
              }
            }
          });
        });
      }

      // schema version 9 changes
      if (oldVersion < 9) {
        // move aliasYAxis changes
        panelUpgrades.push(function(panel) {
          if (panel.type !== 'singlestat' && panel.thresholds !== "") { return; }

          if (panel.thresholds) {
            var k = panel.thresholds.split(",");

            if (k.length >= 3) {
              k.shift();
              panel.thresholds = k.join(",");
            }
          }
        });
      }

      // schema version 10 changes
      if (oldVersion < 10) {
        // move aliasYAxis changes
        panelUpgrades.push(function(panel) {
          if (panel.type !== 'table') { return; }

          _.each(panel.styles, function(style) {
            if (style.thresholds && style.thresholds.length >= 3) {
              var k = style.thresholds;
              k.shift();
              style.thresholds = k;
            }
          });
        });
      }

      if (oldVersion < 12) {
        // update template variables
        _.each(this.templating.list, function(templateVariable) {
          if (templateVariable.refresh) { templateVariable.refresh = 1; }
          if (!templateVariable.refresh) { templateVariable.refresh = 0; }
          if (templateVariable.hideVariable) {
            templateVariable.hide = 2;
          } else if (templateVariable.hideLabel) {
            templateVariable.hide = 1;
          }
        });
      }

      if (oldVersion < 12) {
        // update graph yaxes changes
        panelUpgrades.push(function(panel) {
          if (panel.type !== 'graph') { return; }
          if (!panel.grid) { return; }

          if (!panel.yaxes) {
            panel.yaxes = [
              {
                show: panel['y-axis'],
                min: panel.grid.leftMin,
                max: panel.grid.leftMax,
                logBase: panel.grid.leftLogBase,
                format: panel.y_formats[0],
                label: panel.leftYAxisLabel,
              },
              {
                show: panel['y-axis'],
                min: panel.grid.rightMin,
                max: panel.grid.rightMax,
                logBase: panel.grid.rightLogBase,
                format: panel.y_formats[1],
                label: panel.rightYAxisLabel,
              }
            ];

            panel.xaxis = {
              show: panel['x-axis'],
            };

            delete panel.grid.leftMin;
            delete panel.grid.leftMax;
            delete panel.grid.leftLogBase;
            delete panel.grid.rightMin;
            delete panel.grid.rightMax;
            delete panel.grid.rightLogBase;
            delete panel.y_formats;
            delete panel.leftYAxisLabel;
            delete panel.rightYAxisLabel;
            delete panel['y-axis'];
            delete panel['x-axis'];
          }
        });
      }

      if (oldVersion < 13) {
        // update graph yaxes changes
        panelUpgrades.push(function(panel) {
          if (panel.type !== 'graph') { return; }
          if (!panel.grid) { return; }

          panel.thresholds = [];
          var t1: any = {}, t2: any = {};

          if (panel.grid.threshold1 !== null) {
            t1.value = panel.grid.threshold1;
            if (panel.grid.thresholdLine) {
              t1.line = true;
              t1.lineColor = panel.grid.threshold1Color;
              t1.colorMode = 'custom';
            } else {
              t1.fill = true;
              t1.fillColor = panel.grid.threshold1Color;
              t1.colorMode = 'custom';
            }
          }

          if (panel.grid.threshold2 !== null) {
            t2.value = panel.grid.threshold2;
            if (panel.grid.thresholdLine) {
              t2.line = true;
              t2.lineColor = panel.grid.threshold2Color;
              t2.colorMode = 'custom';
            } else {
              t2.fill = true;
              t2.fillColor = panel.grid.threshold2Color;
              t2.colorMode = 'custom';
            }
          }

          if (_.isNumber(t1.value)) {
            if (_.isNumber(t2.value)) {
              if (t1.value > t2.value) {
                t1.op = t2.op = 'lt';
                panel.thresholds.push(t1);
                panel.thresholds.push(t2);
              } else {
                t1.op = t2.op = 'gt';
                panel.thresholds.push(t1);
                panel.thresholds.push(t2);
              }
            } else {
              t1.op = 'gt';
              panel.thresholds.push(t1);
            }
          }

          delete panel.grid.threshold1;
          delete panel.grid.threshold1Color;
          delete panel.grid.threshold2;
          delete panel.grid.threshold2Color;
          delete panel.grid.thresholdLine;
        });
      }

      if (oldVersion < 14) {
        this.graphTooltip = old.sharedCrosshair ? 1 : 0;
      }

      if (panelUpgrades.length === 0) {
        return;
      }

      for (i = 0; i < this.rows.length; i++) {
        var row = this.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          for (k = 0; k < panelUpgrades.length; k++) {
            panelUpgrades[k].call(this, row.panels[j]);
          }
        }
      }
    }
}

