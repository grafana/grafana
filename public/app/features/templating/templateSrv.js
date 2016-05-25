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

    this.replace = function(target, scopedVars, format) {
      if (!target) { return target; }

      var variable, systemValue, value;
      this._regex.lastIndex = 0;

      return target.replace(this._regex, function(match, g1, g2) {
        variable = self._index[g1 || g2];

        if (scopedVars) {
          value = scopedVars[g1 || g2];
          if (value) {
            return self.formatValue(value.value, format, variable);
          }
        }

        if (!variable) {
          return match;
        }

        systemValue = self._grafanaVariables[variable.current.value];
        if (systemValue) {
          return self.formatValue(systemValue, format, variable);
        }

        value = variable.current.value;
        if (self.isAllValue(value)) {
          value = self.getAllValue(variable);
          // skip formating of custom all values
          if (variable.allValue) {
            return value;
          }
        }

        var res = self.formatValue(value, format, variable);
        return res;
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

  });

});
