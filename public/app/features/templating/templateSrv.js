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

      _.each(this.variables, function(variable) {
         if (!variable.current || !variable.current.isNone && !variable.current.value) { return; }
         this._values[variable.name] = variable.current.value;
       }, this);
    };

    function regexEscape(value) {
      return value.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
    }

    function luceneEscape(value) {
      return value.replace(/([\!\*\+\-\=<>\s\&\|\(\)\[\]\{\}\^\~\?\:\\/"])/g, "\\$1");
    }

    this.formatValue = function(value, format) {
      switch(format) {
        case "regex": {
          var escapedValues = _.map(value, regexEscape);
          return '(' + escapedValues.join('|') + ')';
        }
        case "lucene": {
          if (typeof value === 'string') {
            return luceneEscape(value);
          }
          var quotedValues = _.map(value, function(val) {
            return '\"' + luceneEscape(val) + '\"';
          });
          return '(' + quotedValues.join(' OR ') + ')';
        }
        case "pipe": {
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

      str = _.escape(str);
      this._regex.lastIndex = 0;
      return str.replace(this._regex, function(match, g1, g2) {
        if (self._values[g1 || g2]) {
          return '<span class="template-variable">' + match + '</span>';
        }
        return match;
      });
    };

    this.replace = function(target, scopedVars, format) {
      if (!target) { return target; }

      var value, systemValue;
      this._regex.lastIndex = 0;

      return target.replace(this._regex, function(match, g1, g2) {
        if (scopedVars) {
          value = scopedVars[g1 || g2];
          if (value) {
            return self.formatValue(value.value);
          }
        }

        value = self._values[g1 || g2];
        if (!value) {
          return match;
        }

        systemValue = self._grafanaVariables[value];
        if (systemValue) {
          return self.formatValue(systemValue);
        }

        var res = self.formatValue(value, format);
        console.log('replace: ' + value, res);
        return res;
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
