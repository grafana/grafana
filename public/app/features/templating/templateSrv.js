define([
  'angular',
  'lodash',
  './editorCtrl',
  './templateValuesSrv',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateSrv', function() {
    var self = this;

    this._regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
    this._values = {};
    this._texts = {};
    this._grafanaVariables = {};

    this.init = function(variables) {
      this.variables = variables;
      this.updateTemplateData();
    };

    this.updateTemplateData = function() {
      this._values = {};
      this._texts = {};

      _.each(this.variables, function(variable) {
        if (!variable.current || !variable.current.isNone && !variable.current.value) { return; }

        this._values[variable.name] = this.renderVariableValue(variable);
        this._texts[variable.name] = variable.current.text;
      }, this);
    };

    this.renderVariableValue = function(variable) {
      var value = variable.current.value;
      if (_.isString(value)) {
        return value;
      } else {
        if (variable.multiFormat === 'regex values') {
          return '(' + value.join('|') + ')';
        }
        return '{' + value.join(',') + '}';
      }
    };

    this.setGrafanaVariable = function (name, value) {
      this._grafanaVariables[name] = value;
    };

    this.variableExists = function(expression) {
      this._regex.lastIndex = 0;
      var match = this._regex.exec(expression);
      return match && (self._values[match[1] || match[2]] !== void 0);
    };

    this.containsVariable = function(str, variableName) {
      if (!str) {
        return false;
      }
      return str.indexOf('$' + variableName) !== -1 || str.indexOf('[[' + variableName + ']]') !== -1;
    };

    this.highlightVariablesAsHtml = function(str) {
      if (!str || !_.isString(str)) { return str; }

      this._regex.lastIndex = 0;
      return str.replace(this._regex, function(match, g1, g2) {
        if (self._values[g1 || g2]) {
          return '<span class="template-variable">' + match + '</span>';
        }
        return match;
      });
    };

    this.replace = function(target, scopedVars) {
      if (!target) { return target; }

      var value;
      this._regex.lastIndex = 0;

      return target.replace(this._regex, function(match, g1, g2) {
        if (scopedVars) {
          value = scopedVars[g1 || g2];
          if (value) { return value.value; }
        }

        value = self._values[g1 || g2];
        if (!value) { return match; }

        return self._grafanaVariables[value] || value;
      });
    };

    this.replaceWithText = function(target, scopedVars) {
      if (!target) { return target; }

      var value;
      var text;
      this._regex.lastIndex = 0;

      return target.replace(this._regex, function(match, g1, g2) {
        if (scopedVars) {
          var option = scopedVars[g1 || g2];
          if (option) { return option.text; }
        }

        value = self._values[g1 || g2];
        text = self._texts[g1 || g2];
        if (!value) { return match; }

        return self._grafanaVariables[value] || text;
      });
    };

    this.fillVariableValuesForUrl = function(params) {
      _.each(this.variables, function(variable) {
        params['var-' + variable.name] = variable.current.value;
      });
    };

  });

});
