define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('dynamicDashboardSrv', function()  {

    this.init = function(dashboard) {
      this.handlePanelRepeats(dashboard);
      this.handleRowRepeats(dashboard);
    };

    this.update = function(dashboard) {
      this.handlePanelRepeats(dashboard);
      this.handleRowRepeats(dashboard);
    };

    this.removeLinkedPanels = function(dashboard) {
      var i, j, row, panel;
      for (i = 0; i < dashboard.rows.length; i++) {
        row = dashboard.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.linked) {
            row.panels = _.without(row.panels, panel);
            j = j - 1;
          }
          delete panel.scopedVars;
        }
      }
    };

    this.handlePanelRepeats = function(dashboard) {
      this.removeLinkedPanels(dashboard);

      var i, j, row, panel;
      for (i = 0; i < dashboard.rows.length; i++) {
        row = dashboard.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.repeat) {
            this.repeatPanel(panel, row, dashboard);
          }
        }
      }
    };

    this.removeLinkedRows = function(dashboard) {
      var i, row;
      for (i = 0; i < dashboard.rows.length; i++) {
        row = dashboard.rows[i];
        if (row.linked) {
          dashboard.rows = _.without(dashboard.rows, row);
          i = i - 1;
        }
      }
    };

    this.handleRowRepeats = function(dashboard) {
      this.removeLinkedRows(dashboard);
      var i, row;
      for (i = 0; i < dashboard.rows.length; i++) {
        row = dashboard.rows[i];
        if (row.repeat) {
          this.repeatRow(row, dashboard);
        }
      }
    };

    this.repeatRow = function(row, dashboard) {
      console.log('repeat row');
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
        if (index > 0) {
          copy = angular.copy(row);
          copy.repeat = null;
          copy.linked = true;

          // set new panel ids
          for (i = 0; i < copy.panels.length; i++) {
            panel = row.panels[i];
            panel.id = dashboard.getNextPanelId();
          }

          dashboard.rows.push(copy);
        } else {
          copy = row;
        }

        for (i = 0; i < copy.panels.length; i++) {
          panel = copy.panels[i];
          panel.scopedVars = panel.scopedVars || {};
          panel.scopedVars[variable.name] = option;
        }
      });

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
        if (index > 0) {
          var copy = dashboard.duplicatePanel(panel, row);
          copy.repeat = null;
          copy.linked = true;
          copy.scopedVars = {};
          copy.scopedVars[variable.name] = option;
        } else {
          panel.scopedVars = {};
          panel.scopedVars[variable.name] = option;
        }
        console.log('duplicatePanel');
      });
    };

  });

});

