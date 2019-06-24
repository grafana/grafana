// Libaries
import _ from 'lodash';

// Constants
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { GRID_COLUMN_COUNT, REPEAT_DIR_VERTICAL, GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';

// Utils & Services
import { Emitter } from 'app/core/utils/emitter';
import { contextSrv } from 'app/core/services/context_srv';
import sortByKeys from 'app/core/utils/sort_by_keys';

// Types
import { PanelModel, GridPos } from './PanelModel';
import { DashboardMigrator } from './DashboardMigrator';
import { TimeRange, TimeZone } from '@grafana/ui';
import { UrlQueryValue } from '@grafana/runtime';
import { KIOSK_MODE_TV, DashboardMeta } from 'app/types';
import { toUtc, DateTimeInput, dateTime, isDateTime } from '@grafana/ui/src/utils/moment_wrapper';

export interface CloneOptions {
  saveVariables?: boolean;
  saveTimerange?: boolean;
  message?: string;
}

export class DashboardModel {
  id: any;
  uid: string;
  title: string;
  autoUpdate: any;
  description: any;
  tags: any;
  style: any;
  timezone: any;
  editable: any;
  graphTooltip: any;
  time: any;
  private originalTime: any;
  timepicker: any;
  templating: { list: any[] };
  private originalTemplating: any;
  annotations: { list: any[] };
  refresh: any;
  snapshot: any;
  schemaVersion: number;
  version: number;
  revision: number;
  links: any;
  gnetId: any;
  panels: PanelModel[];

  // ------------------
  // not persisted
  // ------------------

  // repeat process cycles
  iteration: number;
  meta: DashboardMeta;
  events: Emitter;

  static nonPersistedProperties: { [str: string]: boolean } = {
    events: true,
    meta: true,
    panels: true, // needs special handling
    templating: true, // needs special handling
    originalTime: true,
    originalTemplating: true,
  };

  constructor(data: any, meta?: DashboardMeta) {
    if (!data) {
      data = {};
    }

    this.events = new Emitter();
    this.id = data.id || null;
    this.uid = data.uid || null;
    this.revision = data.revision;
    this.title = data.title || 'No Title';
    this.autoUpdate = data.autoUpdate;
    this.description = data.description;
    this.tags = data.tags || [];
    this.style = data.style || 'dark';
    this.timezone = data.timezone || '';
    this.editable = data.editable !== false;
    this.graphTooltip = data.graphTooltip || 0;
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
    this.panels = _.map(data.panels || [], (panelData: any) => new PanelModel(panelData));

    this.resetOriginalVariables();
    this.resetOriginalTime();

    this.initMeta(meta);
    this.updateSchema(data);

    this.addBuiltInAnnotationQuery();
    this.sortPanelsByGridPos();
  }

  addBuiltInAnnotationQuery() {
    let found = false;
    for (const item of this.annotations.list) {
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

  private initMeta(meta: DashboardMeta) {
    meta = meta || {};

    meta.canShare = meta.canShare !== false;
    meta.canSave = meta.canSave !== false;
    meta.canStar = meta.canStar !== false;
    meta.canEdit = meta.canEdit !== false;
    meta.showSettings = meta.canEdit;
    meta.canMakeEditable = meta.canSave && !this.editable;
    meta.fullscreen = false;
    meta.isEditing = false;

    if (!this.editable) {
      meta.canEdit = false;
      meta.canDelete = false;
      meta.canSave = false;
    }

    this.meta = meta;
  }

  // cleans meta data and other non persistent state
  getSaveModelClone(options?: CloneOptions) {
    const defaults = _.defaults(options || {}, {
      saveVariables: true,
      saveTimerange: true,
    });

    // make clone
    let copy: any = {};
    for (const property in this) {
      if (DashboardModel.nonPersistedProperties[property] || !this.hasOwnProperty(property)) {
        continue;
      }

      copy[property] = _.cloneDeep(this[property]);
    }

    // get variable save models
    copy.templating = {
      list: _.map(this.templating.list, (variable: any) =>
        variable.getSaveModel ? variable.getSaveModel() : variable
      ),
    };

    if (!defaults.saveVariables) {
      for (let i = 0; i < copy.templating.list.length; i++) {
        const current = copy.templating.list[i];
        const original: any = _.find(this.originalTemplating, { name: current.name, type: current.type });

        if (!original) {
          continue;
        }

        if (current.type === 'adhoc') {
          copy.templating.list[i].filters = original.filters;
        } else {
          copy.templating.list[i].current = original.current;
        }
      }
    }

    if (!defaults.saveTimerange) {
      copy.time = this.originalTime;
    }

    // get panel save models
    copy.panels = _.chain(this.panels)
      .filter((panel: PanelModel) => panel.type !== 'add-panel')
      .map((panel: PanelModel) => panel.getSaveModel())
      .value();

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

  timeRangeUpdated(timeRange: TimeRange) {
    this.events.emit('time-range-updated', timeRange);
  }

  startRefresh() {
    this.events.emit('refresh');

    for (const panel of this.panels) {
      if (!this.otherPanelInFullscreen(panel)) {
        panel.refresh();
      }
    }
  }

  render() {
    this.events.emit('render');

    for (const panel of this.panels) {
      panel.render();
    }
  }

  panelInitialized(panel: PanelModel) {
    panel.initialized();

    if (!this.otherPanelInFullscreen(panel)) {
      panel.refresh();
    }
  }

  otherPanelInFullscreen(panel: PanelModel) {
    return this.meta.fullscreen && !panel.fullscreen;
  }

  private ensureListExist(data: any) {
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

    for (const panel of this.panels) {
      if (panel.id > max) {
        max = panel.id;
      }

      if (panel.collapsed) {
        for (const rowPanel of panel.panels) {
          if (rowPanel.id > max) {
            max = rowPanel.id;
          }
        }
      }
    }

    return max + 1;
  }

  forEachPanel(callback: (panel: PanelModel, index: number) => void) {
    for (let i = 0; i < this.panels.length; i++) {
      callback(this.panels[i], i);
    }
  }

  getPanelById(id: number): PanelModel {
    for (const panel of this.panels) {
      if (panel.id === id) {
        return panel;
      }
    }
    return null;
  }

  addPanel(panelData: any) {
    panelData.id = this.getNextPanelId();

    const panel = new PanelModel(panelData);

    this.panels.unshift(panel);

    this.sortPanelsByGridPos();

    this.events.emit('panel-added', panel);
  }

  sortPanelsByGridPos() {
    this.panels.sort((panelA, panelB) => {
      if (panelA.gridPos.y === panelB.gridPos.y) {
        return panelA.gridPos.x - panelB.gridPos.x;
      } else {
        return panelA.gridPos.y - panelB.gridPos.y;
      }
    });
  }

  cleanUpRepeats() {
    if (this.snapshot || this.templating.list.length === 0) {
      return;
    }

    this.iteration = (this.iteration || new Date().getTime()) + 1;
    const panelsToRemove = [];

    // cleanup scopedVars
    for (const panel of this.panels) {
      delete panel.scopedVars;
    }

    for (let i = 0; i < this.panels.length; i++) {
      const panel = this.panels[i];
      if ((!panel.repeat || panel.repeatedByRow) && panel.repeatPanelId && panel.repeatIteration !== this.iteration) {
        panelsToRemove.push(panel);
      }
    }

    // remove panels
    _.pull(this.panels, ...panelsToRemove);

    this.sortPanelsByGridPos();
    this.events.emit('repeats-processed');
  }

  processRepeats() {
    if (this.snapshot || this.templating.list.length === 0) {
      return;
    }

    this.cleanUpRepeats();

    this.iteration = (this.iteration || new Date().getTime()) + 1;

    for (let i = 0; i < this.panels.length; i++) {
      const panel = this.panels[i];
      if (panel.repeat) {
        this.repeatPanel(panel, i);
      }
    }

    this.sortPanelsByGridPos();
    this.events.emit('repeats-processed');
  }

  cleanUpRowRepeats(rowPanels: PanelModel[]) {
    const panelsToRemove = [];
    for (let i = 0; i < rowPanels.length; i++) {
      const panel = rowPanels[i];
      if (!panel.repeat && panel.repeatPanelId) {
        panelsToRemove.push(panel);
      }
    }
    _.pull(rowPanels, ...panelsToRemove);
    _.pull(this.panels, ...panelsToRemove);
  }

  processRowRepeats(row: PanelModel) {
    if (this.snapshot || this.templating.list.length === 0) {
      return;
    }

    let rowPanels = row.panels;
    if (!row.collapsed) {
      const rowPanelIndex = _.findIndex(this.panels, (p: PanelModel) => p.id === row.id);
      rowPanels = this.getRowPanels(rowPanelIndex);
    }

    this.cleanUpRowRepeats(rowPanels);

    for (let i = 0; i < rowPanels.length; i++) {
      const panel = rowPanels[i];
      if (panel.repeat) {
        const panelIndex = _.findIndex(this.panels, (p: PanelModel) => p.id === panel.id);
        this.repeatPanel(panel, panelIndex);
      }
    }
  }

  getPanelRepeatClone(sourcePanel: PanelModel, valueIndex: number, sourcePanelIndex: number) {
    // if first clone return source
    if (valueIndex === 0) {
      return sourcePanel;
    }

    const clone = new PanelModel(sourcePanel.getSaveModel());
    clone.id = this.getNextPanelId();

    // insert after source panel + value index
    this.panels.splice(sourcePanelIndex + valueIndex, 0, clone);

    clone.repeatIteration = this.iteration;
    clone.repeatPanelId = sourcePanel.id;
    clone.repeat = null;
    return clone;
  }

  getRowRepeatClone(sourceRowPanel: PanelModel, valueIndex: number, sourcePanelIndex: number) {
    // if first clone return source
    if (valueIndex === 0) {
      if (!sourceRowPanel.collapsed) {
        const rowPanels = this.getRowPanels(sourcePanelIndex);
        sourceRowPanel.panels = rowPanels;
      }
      return sourceRowPanel;
    }

    const clone = new PanelModel(sourceRowPanel.getSaveModel());
    // for row clones we need to figure out panels under row to clone and where to insert clone
    let rowPanels: PanelModel[], insertPos: number;
    if (sourceRowPanel.collapsed) {
      rowPanels = _.cloneDeep(sourceRowPanel.panels);
      clone.panels = rowPanels;
      // insert copied row after preceding row
      insertPos = sourcePanelIndex + valueIndex;
    } else {
      rowPanels = this.getRowPanels(sourcePanelIndex);
      clone.panels = _.map(rowPanels, (panel: PanelModel) => panel.getSaveModel());
      // insert copied row after preceding row's panels
      insertPos = sourcePanelIndex + (rowPanels.length + 1) * valueIndex;
    }
    this.panels.splice(insertPos, 0, clone);

    this.updateRepeatedPanelIds(clone);
    return clone;
  }

  repeatPanel(panel: PanelModel, panelIndex: number) {
    const variable: any = _.find(this.templating.list, { name: panel.repeat } as any);
    if (!variable) {
      return;
    }

    if (panel.type === 'row') {
      this.repeatRow(panel, panelIndex, variable);
      return;
    }

    const selectedOptions = this.getSelectedVariableOptions(variable);
    const maxPerRow = panel.maxPerRow || 4;
    let xPos = 0;
    let yPos = panel.gridPos.y;

    for (let index = 0; index < selectedOptions.length; index++) {
      const option = selectedOptions[index];
      let copy;

      copy = this.getPanelRepeatClone(panel, index, panelIndex);
      copy.scopedVars = copy.scopedVars || {};
      copy.scopedVars[variable.name] = option;

      if (panel.repeatDirection === REPEAT_DIR_VERTICAL) {
        if (index > 0) {
          yPos += copy.gridPos.h;
        }
        copy.gridPos.y = yPos;
      } else {
        // set width based on how many are selected
        // assumed the repeated panels should take up full row width
        copy.gridPos.w = Math.max(GRID_COLUMN_COUNT / selectedOptions.length, GRID_COLUMN_COUNT / maxPerRow);
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

    // Update gridPos for panels below
    const yOffset = yPos - panel.gridPos.y;
    if (yOffset > 0) {
      const panelBelowIndex = panelIndex + selectedOptions.length;
      for (let i = panelBelowIndex; i < this.panels.length; i++) {
        this.panels[i].gridPos.y += yOffset;
      }
    }
  }

  repeatRow(panel: PanelModel, panelIndex: number, variable: any) {
    const selectedOptions = this.getSelectedVariableOptions(variable);
    let yPos = panel.gridPos.y;

    function setScopedVars(panel: PanelModel, variableOption: any) {
      panel.scopedVars = panel.scopedVars || {};
      panel.scopedVars[variable.name] = variableOption;
    }

    for (let optionIndex = 0; optionIndex < selectedOptions.length; optionIndex++) {
      const option = selectedOptions[optionIndex];
      const rowCopy = this.getRowRepeatClone(panel, optionIndex, panelIndex);
      setScopedVars(rowCopy, option);

      const rowHeight = this.getRowHeight(rowCopy);
      const rowPanels = rowCopy.panels || [];
      let panelBelowIndex;

      if (panel.collapsed) {
        // For collapsed row just copy its panels and set scoped vars and proper IDs
        _.each(rowPanels, (rowPanel: PanelModel, i: number) => {
          setScopedVars(rowPanel, option);
          if (optionIndex > 0) {
            this.updateRepeatedPanelIds(rowPanel, true);
          }
        });
        rowCopy.gridPos.y += optionIndex;
        yPos += optionIndex;
        panelBelowIndex = panelIndex + optionIndex + 1;
      } else {
        // insert after 'row' panel
        const insertPos = panelIndex + (rowPanels.length + 1) * optionIndex + 1;
        _.each(rowPanels, (rowPanel: PanelModel, i: number) => {
          setScopedVars(rowPanel, option);
          if (optionIndex > 0) {
            const cloneRowPanel = new PanelModel(rowPanel);
            this.updateRepeatedPanelIds(cloneRowPanel, true);
            // For exposed row additionally set proper Y grid position and add it to dashboard panels
            cloneRowPanel.gridPos.y += rowHeight * optionIndex;
            this.panels.splice(insertPos + i, 0, cloneRowPanel);
          }
        });
        rowCopy.panels = [];
        rowCopy.gridPos.y += rowHeight * optionIndex;
        yPos += rowHeight;
        panelBelowIndex = insertPos + rowPanels.length;
      }

      // Update gridPos for panels below
      for (let i = panelBelowIndex; i < this.panels.length; i++) {
        this.panels[i].gridPos.y += yPos;
      }
    }
  }

  updateRepeatedPanelIds(panel: PanelModel, repeatedByRow?: boolean) {
    panel.repeatPanelId = panel.id;
    panel.id = this.getNextPanelId();
    panel.repeatIteration = this.iteration;
    if (repeatedByRow) {
      panel.repeatedByRow = true;
    } else {
      panel.repeat = null;
    }
    return panel;
  }

  getSelectedVariableOptions(variable: any) {
    let selectedOptions: any[];
    if (variable.current.text === 'All') {
      selectedOptions = variable.options.slice(1, variable.options.length);
    } else {
      selectedOptions = _.filter(variable.options, { selected: true });
    }
    return selectedOptions;
  }

  getRowHeight(rowPanel: PanelModel): number {
    if (!rowPanel.panels || rowPanel.panels.length === 0) {
      return 0;
    }
    const rowYPos = rowPanel.gridPos.y;
    const positions = _.map(rowPanel.panels, 'gridPos');
    const maxPos = _.maxBy(positions, (pos: GridPos) => {
      return pos.y + pos.h;
    });
    return maxPos.y + maxPos.h - rowYPos;
  }

  removePanel(panel: PanelModel) {
    const index = _.indexOf(this.panels, panel);
    this.panels.splice(index, 1);
    this.events.emit('panel-removed', panel);
  }

  removeRow(row: PanelModel, removePanels: boolean) {
    const needToogle = (!removePanels && row.collapsed) || (removePanels && !row.collapsed);

    if (needToogle) {
      this.toggleRow(row);
    }

    this.removePanel(row);
  }

  expandRows() {
    for (let i = 0; i < this.panels.length; i++) {
      const panel = this.panels[i];

      if (panel.type !== 'row') {
        continue;
      }

      if (panel.collapsed) {
        this.toggleRow(panel);
      }
    }
  }

  collapseRows() {
    for (let i = 0; i < this.panels.length; i++) {
      const panel = this.panels[i];

      if (panel.type !== 'row') {
        continue;
      }

      if (!panel.collapsed) {
        this.toggleRow(panel);
      }
    }
  }

  setPanelFocus(id: number) {
    this.meta.focusPanelId = id;
  }

  updateSubmenuVisibility() {
    this.meta.submenuEnabled = (() => {
      if (this.links.length > 0) {
        return true;
      }

      const visibleVars = _.filter(this.templating.list, (variable: any) => variable.hide !== 2);
      if (visibleVars.length > 0) {
        return true;
      }

      const visibleAnnotations = _.filter(this.annotations.list, (annotation: any) => annotation.hide !== true);
      if (visibleAnnotations.length > 0) {
        return true;
      }

      return false;
    })();
  }

  getPanelInfoById(panelId: number) {
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

  duplicatePanel(panel: PanelModel) {
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
      // add below
      newPanel.gridPos.y += panel.gridPos.h;
    }

    this.addPanel(newPanel);
    return newPanel;
  }

  formatDate(date: DateTimeInput, format?: string) {
    date = isDateTime(date) ? date : dateTime(date);
    format = format || 'YYYY-MM-DD HH:mm:ss';
    const timezone = this.getTimezone();

    return timezone === 'browser' ? dateTime(date).format(format) : toUtc(date).format(format);
  }

  destroy() {
    this.events.removeAllListeners();
    for (const panel of this.panels) {
      panel.destroy();
    }
  }

  toggleRow(row: PanelModel) {
    const rowIndex = _.indexOf(this.panels, row);

    if (row.collapsed) {
      row.collapsed = false;
      const hasRepeat = _.some(row.panels as PanelModel[], (p: PanelModel) => p.repeat);

      if (row.panels.length > 0) {
        // Use first panel to figure out if it was moved or pushed
        const firstPanel = row.panels[0];
        const yDiff = firstPanel.gridPos.y - (row.gridPos.y + row.gridPos.h);

        // start inserting after row
        let insertPos = rowIndex + 1;
        // y max will represent the bottom y pos after all panels have been added
        // needed to know home much panels below should be pushed down
        let yMax = row.gridPos.y;

        for (const panel of row.panels) {
          // make sure y is adjusted (in case row moved while collapsed)
          // console.log('yDiff', yDiff);
          panel.gridPos.y -= yDiff;
          // insert after row
          this.panels.splice(insertPos, 0, new PanelModel(panel));
          // update insert post and y max
          insertPos += 1;
          yMax = Math.max(yMax, panel.gridPos.y + panel.gridPos.h);
        }

        const pushDownAmount = yMax - row.gridPos.y - 1;

        // push panels below down
        for (let panelIndex = insertPos; panelIndex < this.panels.length; panelIndex++) {
          this.panels[panelIndex].gridPos.y += pushDownAmount;
        }

        row.panels = [];

        if (hasRepeat) {
          this.processRowRepeats(row);
        }
      }

      // sort panels
      this.sortPanelsByGridPos();

      // emit change event
      this.events.emit('row-expanded');
      return;
    }

    const rowPanels = this.getRowPanels(rowIndex);

    // remove panels
    _.pull(this.panels, ...rowPanels);
    // save panel models inside row panel
    row.panels = _.map(rowPanels, (panel: PanelModel) => panel.getSaveModel());
    row.collapsed = true;

    // emit change event
    this.events.emit('row-collapsed');
  }

  /**
   * Will return all panels after rowIndex until it encounters another row
   */
  getRowPanels(rowIndex: number): PanelModel[] {
    const rowPanels = [];

    for (let index = rowIndex + 1; index < this.panels.length; index++) {
      const panel = this.panels[index];

      // break when encountering another row
      if (panel.type === 'row') {
        break;
      }

      // this panel must belong to row
      rowPanels.push(panel);
    }

    return rowPanels;
  }

  on(eventName: string, callback: Function) {
    this.events.on(eventName, callback);
  }

  off(eventName: string, callback?: Function) {
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

  getRelativeTime(date: DateTimeInput) {
    date = isDateTime(date) ? date : dateTime(date);

    return this.timezone === 'browser' ? dateTime(date).fromNow() : toUtc(date).fromNow();
  }

  isTimezoneUtc() {
    return this.getTimezone() === 'utc';
  }

  isSnapshot() {
    return this.snapshot !== undefined;
  }

  getTimezone(): TimeZone {
    return (this.timezone ? this.timezone : contextSrv.user.timezone) as TimeZone;
  }

  private updateSchema(old: any) {
    const migrator = new DashboardMigrator(this);
    migrator.updateSchema(old);
  }

  resetOriginalTime() {
    this.originalTime = _.cloneDeep(this.time);
  }

  hasTimeChanged() {
    return !_.isEqual(this.time, this.originalTime);
  }

  resetOriginalVariables() {
    this.originalTemplating = _.map(this.templating.list, (variable: any) => {
      return {
        name: variable.name,
        type: variable.type,
        current: _.cloneDeep(variable.current),
        filters: _.cloneDeep(variable.filters),
      };
    });
  }

  hasVariableValuesChanged() {
    if (this.templating.list.length !== this.originalTemplating.length) {
      return false;
    }

    const updated = _.map(this.templating.list, (variable: any) => {
      return {
        name: variable.name,
        type: variable.type,
        current: _.cloneDeep(variable.current),
        filters: _.cloneDeep(variable.filters),
      };
    });

    return !_.isEqual(updated, this.originalTemplating);
  }

  autoFitPanels(viewHeight: number, kioskMode?: UrlQueryValue) {
    const currentGridHeight = Math.max(
      ...this.panels.map(panel => {
        return panel.gridPos.h + panel.gridPos.y;
      })
    );

    const navbarHeight = 55;
    const margin = 20;
    const submenuHeight = 50;

    let visibleHeight = viewHeight - navbarHeight - margin;

    // Remove submenu height if visible
    if (this.meta.submenuEnabled && !kioskMode) {
      visibleHeight -= submenuHeight;
    }

    // add back navbar height
    if (kioskMode && kioskMode !== KIOSK_MODE_TV) {
      visibleHeight += navbarHeight;
    }

    const visibleGridHeight = Math.floor(visibleHeight / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN));
    const scaleFactor = currentGridHeight / visibleGridHeight;

    this.panels.forEach((panel, i) => {
      panel.gridPos.y = Math.round(panel.gridPos.y / scaleFactor) || 1;
      panel.gridPos.h = Math.round(panel.gridPos.h / scaleFactor) || 1;
    });
  }

  templateVariableValueUpdated() {
    this.processRepeats();
    this.events.emit('template-variable-value-updated');
  }

  expandParentRowFor(panelId: number) {
    for (const panel of this.panels) {
      if (panel.collapsed) {
        for (const rowPanel of panel.panels) {
          if (rowPanel.id === panelId) {
            this.toggleRow(panel);
            return;
          }
        }
      }
    }
  }

  toggleLegendsForAll() {
    const panelsWithLegends = this.panels.filter(panel => {
      return panel.legend !== undefined && panel.legend !== null;
    });

    // determine if more panels are displaying legends or not
    const onCount = panelsWithLegends.filter(panel => panel.legend.show).length;
    const offCount = panelsWithLegends.length - onCount;
    const panelLegendsOn = onCount >= offCount;

    for (const panel of panelsWithLegends) {
      panel.legend.show = !panelLegendsOn;
      panel.render();
    }
  }
}
