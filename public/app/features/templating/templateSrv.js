define([
  'angular',
  'lodash',
  'app/core/utils/kbn',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateSrv', function() {
    var self = this;

    this._regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
    this._index = {};
    this._texts = {};
    this._grafanaVariables = {};

    // default built ins
    this._builtIns = {};
    this._builtIns['__interval'] = {text: '1s', value: '1s'};
    this._builtIns['__interval_ms'] = {text: '100', value: '100'};

    this.init = function(variables) {
      this.variables = variables;
      this.updateTemplateData();
    };

    this.updateTemplateData = function() {
      this._index = {};
      this._filters = {};

      for (var i = 0; i < this.variables.length; i++) {
        var variable = this.variables[i];

        if (!variable.current || !variable.current.isNone && !variable.current.value) {
          continue;
        }

        this._index[variable.name] = variable;
      }
    };

    this.variableInitialized = function(variable) {
      this._index[variable.name] = variable;
    };

    this.getAdhocFilters = function(datasourceName) {
      var filters = [];

      for (var i = 0; i < this.variables.length; i++) {
        var variable = this.variables[i];
        if (variable.type !== 'adhoc') {
          continue;
        }

        if (variable.datasource === datasourceName) {
          filters = filters.concat(variable.filters);
        }

        if (variable.datasource.indexOf('$') === 0) {
          if (this.replace(variable.datasource) === datasourceName) {
            filters = filters.concat(variable.filters);
          }
        }
      }

      return filters;
    };

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
            return kbn.regexEscape(value);
          }

          var escapedValues = _.map(value, kbn.regexEscape);
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
        case "distributed": {
          if (typeof value === 'string') {
            return value;
          }
          return this.distributeVariable(value, variable.name);
        }
        default:  {
          if (_.isArray(value)) {
            return '{' + value.join(',') + '}';
          }
          return value;
        }
      }
    };

    this.setGrafanaVariable = function (name, value) {
      this._grafanaVariables[name] = value;
    };

    this.getVariableName = function(expression) {
      this._regex.lastIndex = 0;
      var match = this._regex.exec(expression);
      if (!match) {
        return null;
      }
      return match[1] || match[2];
    };

    this.variableExists = function(expression) {
      var name = this.getVariableName(expression);
      return name && (self._index[name] !== void 0);
    };

    this.highlightVariablesAsHtml = function(str) {
      if (!str || !_.isString(str)) { return str; }

      str = _.escape(str);
      this._regex.lastIndex = 0;
      return str.replace(this._regex, function(match, g1, g2) {
        if (self._index[g1 || g2] || self._builtIns[g1 || g2]) {
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
        if (scopedVars && scopedVars[variable.name] !== void 0) {
          params['var-' + variable.name] = scopedVars[variable.name].value;
        } else {
          params['var-' + variable.name] = variable.getValueForUrl();
        }
      });
    };

    this.distributeVariable = function(value, variable) {
      value = _.map(value, function(val, index) {
        if (index !== 0) {
          return variable + "=" + val;
        } else {
          return val;
        }
      });
      return value.join(',');
    };

  });

});
