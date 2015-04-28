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
      this.dashboard = dashboard;
      this.iteration = new Date().getTime();

      this.handlePanelRepeats(dashboard);
      this.handleRowRepeats(dashboard);
    };

    this.update = function(dashboard) {
      this.dashboard = dashboard;
      this.iteration = this.iteration + 1;

      this.handlePanelRepeats(dashboard);
      this.handleRowRepeats(dashboard);
    };

    this.handlePanelRepeats = function(dashboard) {
      var i, j, row, panel;
      for (i = 0; i < dashboard.rows.length; i++) {
        row = dashboard.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.repeat) {
            this.repeatPanel(panel, row, dashboard);
          }
          // clean up old left overs
          else if (panel.repeatPanelId && panel.repeatIteration !== this.iteration) {
            row.panels = _.without(row.panels, panel);
            j = j - 1;
          }
        }
      }
    };

    this.handleRowRepeats = function(dashboard) {
      var i, row;
      for (i = 0; i < dashboard.rows.length; i++) {
        row = dashboard.rows[i];
        if (row.repeat) {
          this.repeatRow(row, dashboard);
        }
        // clean up old left overs
        else if (row.repeatRowId && row.repeatIteration !== this.iteration) {
          dashboard.rows.splice(i, 1);
          i = i - 1;
        }
      }
    };

    this.getRowClone = function(sourceRow, index) {
      if (index === 0) {
        return sourceRow;
      }

      var i, panel, row;
      var sourceRowId = _.indexOf(this.dashboard.rows, sourceRow) + 1;

      // look for row to reuse
      for (i = 0; i < this.dashboard.rows.length; i++) {
        row = this.dashboard.rows[i];
        if (row.repeatRowId === sourceRowId && row.repeatIteration !== this.iteration) {
          row.repeatIteration = this.iteration;
          return row;
        }
      }

      var copy = angular.copy(sourceRow);
      copy.repeat = null;
      copy.repeatRowId = sourceRowId;
      copy.repeatIteration = this.iteration;
      this.dashboard.rows.push(copy);

      // set new panel ids
      for (i = 0; i < copy.panels.length; i++) {
        panel = copy.panels[i];
        panel.id = this.dashboard.getNextPanelId();
      }

      return copy;
    };

    this.repeatRow = function(row, dashboard) {
      var variables = dashboard.templating.list;
      var variable = _.findWhere(variables, {name: row.repeat.replace('$', '')});
      if (!variable) {
        return;
      }

      var selected, copy, i, panel;
      if (variable.current.text === 'All') {
        selected = variable.options.slice(1, variable.options.length);
      } else {
        selected = _.filter(variable.options, {selected: true});
      }

      _.each(selected, function(option, index) {
        copy = self.getRowClone(row, index);

        for (i = 0; i < copy.panels.length; i++) {
          panel = copy.panels[i];
          panel.scopedVars = panel.scopedVars || {};
          panel.scopedVars[variable.name] = option;
        }
      });
    };

    this.getPanelClone = function(sourcePanel, row, index) {
      // if first clone return source
      if (index === 0) {
        return sourcePanel;
      }

      // first try finding an existing clone to use
      for (var i = 0; i < row.panels.length; i++) {
        var panel = row.panels[i];
        if (panel.repeatIteration !== this.iteration && panel.repeatPanelId === sourcePanel.id) {
          panel.repeatIteration = this.iteration;
          return panel;
        }
      }

      var clone = this.dashboard.duplicatePanel(sourcePanel, row);
      clone.repeatIteration = this.iteration;
      clone.repeatPanelId = sourcePanel.id;
      clone.repeat = null;
      return clone;
    };

    this.repeatPanel = function(panel, row, dashboard) {
      var variables = dashboard.templating.list;
      var variable = _.findWhere(variables, {name: panel.repeat.replace('$', '')});
      if (!variable) {
        return;
      }

      var selected;
      if (variable.current.text === 'All') {
        selected = variable.options.slice(1, variable.options.length);
      } else {
        selected = _.filter(variable.options, {selected: true});
      }

      _.each(selected, function(option, index) {
        var copy = self.getPanelClone(panel, row, index);
        copy.scopedVars = {};
        copy.scopedVars[variable.name] = option;
      });
    };

  });

});
