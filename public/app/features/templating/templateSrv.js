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
    this._index = {};
    this._texts = {};
    this._grafanaVariables = {};

    this.init = function(variables) {
      this.variables = variables;
      this.updateTemplateData();
    };

    this.updateTemplateData = function() {
      this._index = {};

      for (var i = 0; i < this.variables.length; i++) {
        var variable = this.variables[i];
        if (!variable.current || !variable.current.isNone && !variable.current.value) {
          continue;
        }
        this._index[variable.name] = variable;
      }
    };

    function regexEscape(value) {
      return value.replace(/[\\^$*+?.()|[\]{}\/]/g, '\\$&');
    }

    function luceneEscape(value) {
      return value.replace(/([\!\*\+\-\=<>\s\&\|\(\)\[\]\{\}\^\~\?\:\\/"])/g, "\\$1");
    }

    this.luceneFormat = function(value) {
      if (typeof value === 'string') {
        return luceneEscape(value);
      }
      var quotedValues = _.map(value, function(val) {
        return '\"' + luceneEscape(val) + '\"';
      });
      return '(' + quotedValues.join(' OR ') + ')';
    };

    this.formatValue = function(value, format, variable) {
      // for some scopedVars there is no variable
      variable = variable || {};

      if (typeof format === 'function') {
        return format(value, variable, this.formatValue);
      }

      switch(format) {
        case "regex": {
          if (typeof value === 'string') {
            return regexEscape(value);
          }

          var escapedValues = _.map(value, regexEscape);
          return '(' + escapedValues.join('|') + ')';
        }
        case "lucene": {
          return this.luceneFormat(value, format, variable);
        }
        case "pipe": {
          if (typeof value === 'string') {
            return value;
          }
          return value.join('|');
        }
        default:  {
          if (typeof value === 'string') {
            return value;
          }
          return '{' + value.join(',') + '}';
        }
      }
    };

    this.setGrafanaVariable = function (name, value) {
      this._grafanaVariables[name] = value;
    };

    this.variableExists = function(expression) {
      this._regex.lastIndex = 0;
      var match = this._regex.exec(expression);
      return match && (self._index[match[1] || match[2]] !== void 0);
    };

    this.containsVariable = function(str, variableName) {
      if (!str) {
        return false;
      }

      variableName = regexEscape(variableName);
      var findVarRegex = new RegExp('\\$(' + variableName + ')(?:\\W|$)|\\[\\[(' + variableName + ')\\]\\]', 'g');
      var match = findVarRegex.exec(str);
      return match !== null;
    };

    this.highlightVariablesAsHtml = function(str) {
      if (!str || !_.isString(str)) { return str; }

      str = _.escape(str);
      this._regex.lastIndex = 0;
      return str.replace(this._regex, function(match, g1, g2) {
        if (self._index[g1 || g2]) {
          return '<span class="template-variable">' + match + '</span>';
        }
        return match;
      });
    };

    this.getAllValue = function(variable) {
      if (variable.allValue) {
        return variable.allValue;
      }
      var values = [];
      for (var i = 1; i < variable.options.length; i++) {
        values.push(variable.options[i].value);
      }
      return values;
    };

    this.getVarValues = function(varName, scopedVars) {
      var variable = self._index[varName];
      if (scopedVars) {
        var scoped = scopedVars[varName];
        if (scoped) {
          return { variable: variable, values: [scoped.value], skipFormatting: false };
        }
      }
      if (!variable) {
        return { variable: variable, values: [], skipFormatting: false };
      }
      var value = variable.current.value;
      var systemValue = self._grafanaVariables[value];
      var skipFormatting = false;
      if (systemValue) {
        value = [systemValue];
      } else if (self.isAllValue(value)) {
        value = self.getAllValue(variable);
        if (variable.allValue) {
          skipFormatting = true;
        }
      } else if (!(value instanceof Array)) {
        value = [value];
      }
      return { variable: variable, values: value, skipFormatting: skipFormatting };
    };

    this.replace = function(target, scopedVars, format) {
      if (!target) { return target; }

      self._regex.lastIndex = 0;

      return target.replace(self._regex, function(match, g1, g2) {
        var varValues = self.getVarValues(g1 || g2, scopedVars);
        if (!varValues.variable) {
          return match;
        }
        if (varValues.skipFormatting) {
          return varValues.values;
        }
        // For compatibility return direct string rather than single-value array
        if (varValues.values.length === 1) {
          return self.formatValue(varValues.values[0], format, varValues.variable);
        }
        return self.formatValue(varValues.values, format, varValues.variable);
      });
    };

    this.isAllValue = function(value) {
      return value === '$__all' || Array.isArray(value) && value[0] === '$__all';
    };

    this.replaceWithText = function(target, scopedVars) {
      if (!target) { return target; }

      var variable;
      this._regex.lastIndex = 0;

      return target.replace(this._regex, function(match, g1, g2) {
        if (scopedVars) {
          var option = scopedVars[g1 || g2];
          if (option) { return option.text; }
        }

        variable = self._index[g1 || g2];
        if (!variable) { return match; }

        return self._grafanaVariables[variable.current.value] || variable.current.text;
      });
    };

    this.fillVariableValuesForUrl = function(params, scopedVars) {
      _.each(this.variables, function(variable) {
        var current = variable.current;
        var value = current.value;

        if (current.text === 'All') {
          value = 'All';
        }

        if (scopedVars && scopedVars[variable.name] !== void 0) {
          value = scopedVars[variable.name].value;
        }

        params['var-' + variable.name] = value;
      });
    };

    this.resolveTemplateTarget = function(target, scopedVars) {
      var names = [], match;
      // Extract all variable names
      self._regex.lastIndex = 0;
      while ((match = self._regex.exec(target)) != null) {
        names.push({full: match[0], short: match[1] || match[2]});
      }
      var resolved = [target];
      // For each extracted variable and each of its values, build a resolved target string
      if (names.length > 0) {
        names.forEach(function(name) {
          var values = self.getVarValues(name.short, scopedVars).values;
          var newResolved = [];
          values.forEach(function(val) {
            resolved.forEach(function(target) {
              newResolved.push(target.replace(name.full, val));
            });
          });
          resolved = newResolved;
        });
      }
      return resolved;
    };

  });

});
