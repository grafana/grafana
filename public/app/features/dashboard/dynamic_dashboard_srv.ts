///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

import coreModule from 'app/core/core_module';
import {DashboardRow} from './row/row_model';

export class DynamicDashboardSrv {
  iteration: number;
  dashboard: any;
  variables: any;

  init(dashboard) {
    this.dashboard = dashboard;
    this.variables = dashboard.templating.list;
  }

  process(options?) {
    if (this.dashboard.snapshot || this.variables.length === 0) {
      return;
    }

    this.iteration = (this.iteration || new Date().getTime()) + 1;

    options = options || {};
    var cleanUpOnly = options.cleanUpOnly;
    var i, j, row, panel;

    // cleanup scopedVars
    for (i = 0; i < this.dashboard.rows.length; i++) {
      row = this.dashboard.rows[i];
      delete row.scopedVars;

      for (j = 0; j < row.panels.length; j++) {
        delete row.panels[j].scopedVars;
      }
    }

    for (i = 0; i < this.dashboard.rows.length; i++) {
      row = this.dashboard.rows[i];

      // handle row repeats
      if (row.repeat) {
        if (!cleanUpOnly) {
          this.repeatRow(row, i);
        }
      } else if (row.repeatRowId && row.repeatIteration !== this.iteration) {
        // clean up old left overs
        this.dashboard.removeRow(row, true);
        i = i - 1;
        continue;
      }

      // repeat panels
      for (j = 0; j < row.panels.length; j++) {
        panel = row.panels[j];
        if (panel.repeat) {
          if (!cleanUpOnly) {
            this.repeatPanel(panel, row);
          }
        } else if (panel.repeatPanelId && panel.repeatIteration !== this.iteration) {
          // clean up old left overs
          row.panels = _.without(row.panels, panel);
          j = j - 1;
        }
      }

      row.panelSpanChanged();
    }
  }

  // returns a new row clone or reuses a clone from previous iteration
  getRowClone(sourceRow, repeatIndex, sourceRowIndex) {
    if (repeatIndex === 0) {
      return sourceRow;
    }

    var i, panel, row, copy;
    var sourceRowId = sourceRowIndex + 1;

    // look for row to reuse
    for (i = 0; i < this.dashboard.rows.length; i++) {
      row = this.dashboard.rows[i];
      if (row.repeatRowId === sourceRowId && row.repeatIteration !== this.iteration) {
        copy = row;
        copy.copyPropertiesFromRowSource(sourceRow);
        break;
      }
    }

    if (!copy) {
      var modelCopy = angular.copy(sourceRow.getSaveModel());
      copy = new DashboardRow(modelCopy);
      this.dashboard.rows.splice(sourceRowIndex + repeatIndex, 0, copy);

      // set new panel ids
      for (i = 0; i < copy.panels.length; i++) {
        panel = copy.panels[i];
        panel.id = this.dashboard.getNextPanelId();
      }
    }

    copy.repeat = null;
    copy.repeatRowId = sourceRowId;
    copy.repeatIteration = this.iteration;
    return copy;
  }

  // returns a new row clone or reuses a clone from previous iteration
  repeatRow(row, rowIndex) {
    var variable = _.find(this.variables, {name: row.repeat});
    if (!variable) {
      return;
    }

    var selected, copy, i, panel;
    if (variable.current.text === 'All') {
      selected = variable.options.slice(1, variable.options.length);
    } else {
      selected = _.filter(variable.options, {selected: true});
    }

    _.each(selected, (option, index) => {
      copy = this.getRowClone(row, index, rowIndex);
      copy.scopedVars = {};
      copy.scopedVars[variable.name] = option;

      for (i = 0; i < copy.panels.length; i++) {
        panel = copy.panels[i];
        panel.scopedVars = {};
        panel.scopedVars[variable.name] = option;
      }
    });
  }

  getPanelClone(sourcePanel, row, index) {
    // if first clone return source
    if (index === 0) {
      return sourcePanel;
    }

    var i, tmpId, panel, clone;

    // first try finding an existing clone to use
    for (i = 0; i < row.panels.length; i++) {
      panel = row.panels[i];
      if (panel.repeatIteration !== this.iteration && panel.repeatPanelId === sourcePanel.id) {
        clone = panel;
        break;
      }
    }

    if (!clone) {
      clone = { id: this.dashboard.getNextPanelId() };
      row.panels.push(clone);
    }

    // save id
    tmpId = clone.id;
    // copy properties from source
    angular.copy(sourcePanel, clone);
    // restore id
    clone.id = tmpId;
    clone.repeatIteration = this.iteration;
    clone.repeatPanelId = sourcePanel.id;
    clone.repeat = null;
    return clone;
  }

  repeatPanel(panel, row) {
    var variable = _.find(this.variables, {name: panel.repeat});
    if (!variable) { return; }

    var selected;
    if (variable.current.text === 'All') {
      selected = variable.options.slice(1, variable.options.length);
    } else {
      selected = _.filter(variable.options, {selected: true});
    }

    _.each(selected, (option, index) => {
      var copy = this.getPanelClone(panel, row, index);
      copy.span = Math.max(12 / selected.length, panel.minSpan || 4);
      copy.scopedVars = copy.scopedVars || {};
      copy.scopedVars[variable.name] = option;
    });
  }
}

coreModule.service('dynamicDashboardSrv', DynamicDashboardSrv);

