import moment from 'moment';
import _ from 'lodash';

import {GRID_COLUMN_COUNT, GRID_CELL_HEIGHT, REPEAT_DIR_VERTICAL} from 'app/core/constants';
import {DEFAULT_ANNOTATION_COLOR} from 'app/core/utils/colors';
import {Emitter} from 'app/core/utils/emitter';
import {contextSrv} from 'app/core/services/context_srv';
import sortByKeys from 'app/core/utils/sort_by_keys';

import {PanelModel} from './panel_model';

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
  folderId: number;
  panels: PanelModel[];

  // ------------------
  // not persisted
  // ------------------

  // repeat process cycles
  iteration: number;
  meta: any;
  events: Emitter;

  static nonPersistedProperties: {[str: string]: boolean} = {
    events: true,
    meta: true,
    panels: true, // needs special handling
    templating: true, // needs special handling
  };

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
    this.style = data.style || 'dark';
    this.timezone = data.timezone || '';
    this.editable = data.editable !== false;
    this.graphTooltip = data.graphTooltip || 0;
    this.hideControls = data.hideControls || false;
    this.time = data.time || {from: 'now-6h', to: 'now'};
    this.timepicker = data.timepicker || {};
    this.templating = this.ensureListExist(data.templating);
    this.annotations = this.ensureListExist(data.annotations);
    this.refresh = data.refresh;
    this.snapshot = data.snapshot;
    this.schemaVersion = data.schemaVersion || 0;
    this.version = data.version || 0;
    this.links = data.links || [];
    this.gnetId = data.gnetId || null;
    this.folderId = data.folderId || null;
    this.panels = _.map(data.panels || [], panelData => new PanelModel(panelData));

    this.initMeta(meta);
    this.updateSchema(data);

    this.addBuiltInAnnotationQuery();
    this.sortPanelsByGridPos();
  }

  addBuiltInAnnotationQuery() {
    let found = false;
    for (let item of this.annotations.list) {
      if (item.builtIn === 1) {
        found = true;
        break;
      }
    }

    if (found) {
      return;
    }

    this.annotations.list.unshift({
      datasource: '-- Grafana --',
      name: 'Annotations & Alerts',
      type: 'dashboard',
      iconColor: DEFAULT_ANNOTATION_COLOR,
      enable: true,
      hide: true,
      builtIn: 1,
    });
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
    // make clone
    var copy: any = {};
    for (var property in this) {
      if (DashboardModel.nonPersistedProperties[property] || !this.hasOwnProperty(property)) {
        continue;
      }

      copy[property] = _.cloneDeep(this[property]);
    }

    // get variable save models
    copy.templating = {
      list: _.map(this.templating.list, variable => (variable.getSaveModel ? variable.getSaveModel() : variable)),
    };

    // get panel save models
    copy.panels = _.map(this.panels, panel => panel.getSaveModel());

    //  sort by keys
    copy = sortByKeys(copy);

    return copy;
  }

  setViewMode(panel: PanelModel, fullscreen: boolean, isEditing: boolean) {
    this.meta.fullscreen = fullscreen;
    this.meta.isEditing = isEditing && this.meta.canEdit;

    panel.setViewMode(fullscreen, this.meta.isEditing);

    this.events.emit('view-mode-changed', panel);
  }

  private ensureListExist(data) {
    if (!data) {
      data = {};
    }
    if (!data.list) {
      data.list = [];
    }
    return data;
  }

  getNextPanelId() {
    let max = 0;

    for (let panel of this.panels) {
      if (panel.id > max) {
        max = panel.id;
      }
    }

    return max + 1;
  }

  forEachPanel(callback) {
    for (let i = 0; i < this.panels.length; i++) {
      callback(this.panels[i], i);
    }
  }

  getPanelById(id) {
    for (let panel of this.panels) {
      if (panel.id === id) {
        return panel;
      }
    }
    return null;
  }

  addPanel(panelData) {
    panelData.id = this.getNextPanelId();

    let panel = new PanelModel(panelData);

    this.panels.unshift(panel);

    this.sortPanelsByGridPos();

    this.events.emit('panel-added', panel);
  }

  sortPanelsByGridPos() {
    this.panels.sort(function(panelA, panelB) {
      if (panelA.gridPos.y === panelB.gridPos.y) {
        return panelA.gridPos.x - panelB.gridPos.x;
      } else {
        return panelA.gridPos.y - panelB.gridPos.y;
      }
    });
  }

  cleanUpRepeats() {
    this.processRepeats(true);
  }

  processRepeats(cleanUpOnly?: boolean) {
    if (this.snapshot || this.templating.list.length === 0) {
      return;
    }

    this.iteration = (this.iteration || new Date().getTime()) + 1;
    let panelsToRemove = [];

    // cleanup scopedVars
    for (let panel of this.panels) {
      delete panel.scopedVars;
    }

    for (let i = 0; i < this.panels.length; i++) {
      let panel = this.panels[i];
      if (panel.repeat) {
        if (!cleanUpOnly) {
          this.repeatPanel(panel, i);
        }
      } else if (panel.repeatPanelId && panel.repeatIteration !== this.iteration) {
        panelsToRemove.push(panel);
      }
    }

    // for (let panel of this.panels) {
    //   if (panel.repeat) {
    //     if (!cleanUpOnly) {
    //       this.repeatPanel(panel);
    //     }
    //   } else if (panel.repeatPanelId && panel.repeatIteration !== this.iteration) {
    //     panelsToRemove.push(panel);
    //   }
    // }

    // remove panels
    _.pull(this.panels, ...panelsToRemove);

    this.sortPanelsByGridPos();
    this.events.emit('repeats-processed');
  }

  getPanelRepeatClone(sourcePanel, valueIndex, sourcePanelIndex) {
    // if first clone return source
    if (valueIndex === 0) {
      return sourcePanel;
    }

    var clone = new PanelModel(sourcePanel.getSaveModel());
    clone.id = this.getNextPanelId();

    if (sourcePanel.type === 'row') {
      // for row clones we need to figure out panels under row to clone and where to insert clone
      let rowPanels = this.getRowPanels(sourcePanelIndex);
      clone.panels = _.map(rowPanels, panel => panel.getSaveModel());

      // insert after preceding row's panels
      let insertPos = sourcePanelIndex + ((rowPanels.length + 1)*valueIndex);
      this.panels.splice(insertPos, 0, clone);
    } else {
      // insert after source panel + value index
      this.panels.splice(sourcePanelIndex+valueIndex, 0, clone);
    }

    clone.repeatIteration = this.iteration;
    clone.repeatPanelId = sourcePanel.id;
    clone.repeat = null;
    return clone;
  }

  getBottomYForRow() {
  }

  repeatPanel(panel: PanelModel, panelIndex: number) {
    var variable = _.find(this.templating.list, {name: panel.repeat});
    if (!variable) {
      return;
    }

    var selected;
    if (variable.current.text === 'All') {
      selected = variable.options.slice(1, variable.options.length);
    } else {
      selected = _.filter(variable.options, {selected: true});
    }

    let minWidth = panel.minSpan || 6;
    let xPos = 0;
    let yPos = panel.gridPos.y;

    for (let index = 0; index < selected.length; index++) {
      var option = selected[index];
      var copy = this.getPanelRepeatClone(panel, index, panelIndex);

      copy.scopedVars = {};
      copy.scopedVars[variable.name] = option;

      if (copy.type === 'row') {
        // place row below row panels
      }

      if (panel.repeatDirection === REPEAT_DIR_VERTICAL) {
        copy.gridPos.y = yPos;
        yPos += copy.gridPos.h;
      } else {
        // set width based on how many are selected
        // assumed the repeated panels should take up full row width

        copy.gridPos.w = Math.max(GRID_COLUMN_COUNT / selected.length, minWidth);
        copy.gridPos.x = xPos;
        copy.gridPos.y = yPos;

        xPos += copy.gridPos.w;

        // handle overflow by pushing down one row
        if (xPos + copy.gridPos.w > GRID_COLUMN_COUNT) {
          xPos = 0;
          yPos += copy.gridPos.h;
        }
      }
    }
  }

  removePanel(panel: PanelModel) {
    var index = _.indexOf(this.panels, panel);
    this.panels.splice(index, 1);
    this.events.emit('panel-removed', panel);
  }

  setPanelFocus(id) {
    this.meta.focusPanelId = id;
  }

  updateSubmenuVisibility() {
    this.meta.submenuEnabled = (() => {
      if (this.links.length > 0) {
        return true;
      }

      var visibleVars = _.filter(this.templating.list, variable => variable.hide !== 2);
      if (visibleVars.length > 0) {
        return true;
      }

      var visibleAnnotations = _.filter(this.annotations.list, annotation => annotation.hide !== true);
      if (visibleAnnotations.length > 0) {
        return true;
      }

      return false;
    })();
  }

  getPanelInfoById(panelId) {
    for (let i = 0; i < this.panels.length; i++) {
      if (this.panels[i].id === panelId) {
        return {
          panel: this.panels[i],
          index: i,
        };
      }
    }

    return null;
  }

  duplicatePanel(panel) {
    const newPanel = panel.getSaveModel();
    newPanel.id = this.getNextPanelId();

    delete newPanel.repeat;
    delete newPanel.repeatIteration;
    delete newPanel.repeatPanelId;
    delete newPanel.scopedVars;
    if (newPanel.alert) {
      delete newPanel.thresholds;
    }
    delete newPanel.alert;

    // does it fit to the right?
    if (panel.gridPos.x + panel.gridPos.w * 2 <= GRID_COLUMN_COUNT) {
      newPanel.gridPos.x += panel.gridPos.w;
    } else {
      // add bellow
      newPanel.gridPos.y += panel.gridPos.h;
    }

    this.addPanel(newPanel);
    return newPanel;
  }

  formatDate(date, format?) {
    date = moment.isMoment(date) ? date : moment(date);
    format = format || 'YYYY-MM-DD HH:mm:ss';
    let timezone = this.getTimezone();

    return timezone === 'browser' ? moment(date).format(format) : moment.utc(date).format(format);
  }

  destroy() {
    this.events.removeAllListeners();
    for (let panel of this.panels) {
      panel.destroy();
    }
  }

  toggleRow(row: PanelModel) {
    let rowIndex = _.indexOf(this.panels, row);

    if (row.collapsed) {
      row.collapsed = false;

      if (row.panels.length > 0) {
        // Use first panel to figure out if it was moved or pushed
        let firstPanel = row.panels[0];
        let yDiff = firstPanel.gridPos.y - (row.gridPos.y + row.gridPos.h);

        // start inserting after row
        let insertPos = rowIndex+1;
        // y max will represent the bottom y pos after all panels have been added
        // needed to know home much panels below should be pushed down
        let yMax = row.gridPos.y;

        for (let panel of row.panels) {
          // make sure y is adjusted (in case row moved while collapsed)
          panel.gridPos.y -= yDiff;
          // insert after row
          this.panels.splice(insertPos, 0, new PanelModel(panel));
          // update insert post and y max
          insertPos += 1;
          yMax = Math.max(yMax, panel.gridPos.y + panel.gridPos.h);
        }

        const pushDownAmount = yMax - row.gridPos.y;

        // push panels below down
        for (let panelIndex = insertPos; panelIndex < this.panels.length; panelIndex++) {
          this.panels[panelIndex].gridPos.y += pushDownAmount;
        }

        row.panels = [];
      }

      // sort panels
      this.sortPanelsByGridPos();

      // emit change event
      this.events.emit('row-expanded');
      return;
    }

    let rowPanels = this.getRowPanels(rowIndex);

    // remove panels
    _.pull(this.panels, ...rowPanels);
    // save panel models inside row panel
    row.panels = _.map(rowPanels, panel => panel.getSaveModel());
    row.collapsed = true;

    // emit change event
    this.events.emit('row-collapsed');
  }

  /**
   * Will return all panels after rowIndex until it encounters another row
   */
  getRowPanels(rowIndex: number): PanelModel[] {
    let rowPanels = [];

    for (let index = rowIndex+1; index < this.panels.length; index++) {
      let panel = this.panels[index];

      // break when encountering another row
      if (panel.type === 'row') {
        break;
      }

      // this panel must belong to row
      rowPanels.push(panel);
    }

    return rowPanels;
  }

  on(eventName, callback) {
    this.events.on(eventName, callback);
  }

  off(eventName, callback?) {
    this.events.off(eventName, callback);
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

    return this.timezone === 'browser' ? moment(date).fromNow() : moment.utc(date).fromNow();
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
    this.schemaVersion = 16;

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

        if (_.isBoolean(panel.legend)) {
          panel.legend = {show: panel.legend};
        }

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
        if (panel.type !== 'graph') {
          return;
        }
        _.each(panel.aliasYAxis, function(value, key) {
          panel.seriesOverrides = [{alias: key, yaxis: value}];
        });
        delete panel.aliasYAxis;
      });
    }

    if (oldVersion < 6) {
      // move pulldowns to new schema
      var annotations = _.find(old.pulldowns, {type: 'annotations'});

      if (annotations) {
        this.annotations = {
          list: annotations.annotations || [],
        };
      }

      // update template variables
      for (i = 0; i < this.templating.list.length; i++) {
        var variable = this.templating.list[i];
        if (variable.datasource === void 0) {
          variable.datasource = null;
        }
        if (variable.type === 'filter') {
          variable.type = 'query';
        }
        if (variable.type === void 0) {
          variable.type = 'query';
        }
        if (variable.allFormat === void 0) {
          variable.allFormat = 'glob';
        }
      }
    }

    if (oldVersion < 7) {
      if (old.nav && old.nav.length) {
        this.timepicker = old.nav[0];
      }

      // ensure query refIds
      panelUpgrades.push(function(panel) {
        _.each(
          panel.targets,
          function(target) {
            if (!target.refId) {
              target.refId = this.getNextQueryLetter(panel);
            }
          }.bind(this),
        );
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
                if (part.type === 'time' && part.interval) {
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
        if (panel.type !== 'singlestat' && panel.thresholds !== '') {
          return;
        }

        if (panel.thresholds) {
          var k = panel.thresholds.split(',');

          if (k.length >= 3) {
            k.shift();
            panel.thresholds = k.join(',');
          }
        }
      });
    }

    // schema version 10 changes
    if (oldVersion < 10) {
      // move aliasYAxis changes
      panelUpgrades.push(function(panel) {
        if (panel.type !== 'table') {
          return;
        }

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
        if (templateVariable.refresh) {
          templateVariable.refresh = 1;
        }
        if (!templateVariable.refresh) {
          templateVariable.refresh = 0;
        }
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
        if (panel.type !== 'graph') {
          return;
        }
        if (!panel.grid) {
          return;
        }

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
            },
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
        if (panel.type !== 'graph') {
          return;
        }
        if (!panel.grid) {
          return;
        }

        panel.thresholds = [];
        var t1: any = {},
          t2: any = {};

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

    if (oldVersion < 16) {
      this.upgradeToGridLayout(old);
    }

    if (panelUpgrades.length === 0) {
      return;
    }

    for (j = 0; j < this.panels.length; j++) {
      for (k = 0; k < panelUpgrades.length; k++) {
        panelUpgrades[k].call(this, this.panels[j]);
      }
    }
  }

  upgradeToGridLayout(old) {
    let yPos = 0;
    let widthFactor = GRID_COLUMN_COUNT / 12;
    //let rowIds = 1000;
    //

    if (!old.rows) {
      return;
    }

    for (let row of old.rows) {
      let xPos = 0;
      let height: any = row.height || 250;

      // if (this.meta.keepRows) {
      //   this.panels.push({
      //     id: rowIds++,
      //     type: 'row',
      //     title: row.title,
      //     x: 0,
      //     y: yPos,
      //     height: 1,
      //     width: 12
      //   });
      //
      //   yPos += 1;
      // }

      if (_.isString(height)) {
        height = parseInt(height.replace('px', ''), 10);
      }

      const rowGridHeight = Math.ceil(height / GRID_CELL_HEIGHT);

      for (let panel of row.panels) {
        const panelWidth = Math.floor(panel.span) * widthFactor;

        // should wrap to next row?
        if (xPos + panelWidth >= GRID_COLUMN_COUNT) {
          yPos += rowGridHeight;
        }

        panel.gridPos = {x: xPos, y: yPos, w: panelWidth, h: rowGridHeight};

        delete panel.span;

        xPos += panel.gridPos.w;

        this.panels.push(new PanelModel(panel));
      }

      yPos += rowGridHeight;
    }
  }
}
