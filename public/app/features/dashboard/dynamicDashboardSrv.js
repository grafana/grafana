define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('dynamicDashboardSrv', function()  {
    var self = this;

    this.init = function(dashboard) {
      this.iteration = new Date().getTime();
      this.process(dashboard);
    };

    this.update = function(dashboard) {
      this.iteration = this.iteration + 1;
      this.process(dashboard);
    };

    this.process = function(dashboard) {
      if (dashboard.templating.list.length === 0) { return; }
      this.dashboard = dashboard;

      var i, j, row, panel;
      for (i = 0; i < this.dashboard.rows.length; i++) {
        row = this.dashboard.rows[i];

        // handle row repeats
        if (row.repeat) {
          this.repeatRow(row);
        }
        // clean up old left overs
        else if (row.repeatRowId && row.repeatIteration !== this.iteration) {
          this.dashboard.rows.splice(i, 1);
          i = i - 1;
        }

        // repeat panels
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.repeat) {
            this.repeatPanel(panel, row);
          }
          // clean up old left overs
          else if (panel.repeatPanelId && panel.repeatIteration !== this.iteration) {
            row.panels = _.without(row.panels, panel);
            j = j - 1;
          }
        }
      }
    };

    // returns a new row clone or reuses a clone from previous iteration
    this.getRowClone = function(sourceRow, index) {
      if (index === 0) {
        return sourceRow;
      }

      var i, panel, row, copy;
      var sourceRowId = _.indexOf(this.dashboard.rows, sourceRow) + 1;

      // look for row to reuse
      for (i = 0; i < this.dashboard.rows.length; i++) {
        row = this.dashboard.rows[i];
        if (row.repeatRowId === sourceRowId && row.repeatIteration !== this.iteration) {
          copy = row;
          break;
        }
      }

      if (!copy) {
        copy = angular.copy(sourceRow);
        this.dashboard.rows.push(copy);

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
    };

    // returns a new panel clone or reuses a clone from previous iteration
    this.repeatRow = function(row) {
      var variables = this.dashboard.templating.list;
      var variable = _.findWhere(variables, {name: row.repeat});
      if (!variable) {
        return;
      }

      var selected, copy, i, panel;
      if (variable.current && variable.current.text === 'All') {
        selected = variable.options.slice(1, variable.options.length);
      } else {
        selected = _.filter(variable.options, {selected: true});
      }

      _.each(selected, function(option, index) {
        copy = self.getRowClone(row, index);
        copy.scopedVars = {};
        copy.scopedVars[variable.name] = option;

        for (i = 0; i < copy.panels.length; i++) {
          panel = copy.panels[i];
          panel.scopedVars = {};
          panel.scopedVars[variable.name] = option;
        }
      });
    };

    this.getPanelClone = function(sourcePanel, row, index) {
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
    };

    this.repeatPanel = function(panel, row) {
      var variables = this.dashboard.templating.list;
      var variable = _.findWhere(variables, {name: panel.repeat});
      if (!variable) { return; }

      var selected;
      if (variable.current.text === 'All') {
        selected = variable.options.slice(1, variable.options.length);
      } else {
        selected = _.filter(variable.options, {selected: true});
      }

      _.each(selected, function(option, index) {
        var copy = self.getPanelClone(panel, row, index);
        copy.scopedVars = copy.scopedVars || {};
        copy.scopedVars[variable.name] = option;
      });
    };

  });
});
