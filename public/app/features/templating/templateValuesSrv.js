define([
  'angular',
  'lodash',
  'kbn',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateValuesSrv', function($q, $rootScope, datasourceSrv, $location, templateSrv, timeSrv) {
    var self = this;

    $rootScope.onAppEvent('time-range-changed', function()  {
      var variable = _.findWhere(self.variables, { type: 'interval' });
      if (variable) {
        self.updateAutoInterval(variable);
      }
    });

    this.init = function(dashboard) {
      this.variables = dashboard.templating.list;
      templateSrv.init(this.variables);

      var queryParams = $location.search();
      var promises = [];

      for (var i = 0; i < this.variables.length; i++) {
        var variable = this.variables[i];
        var urlValue = queryParams['var-' + variable.name];
        if (urlValue !== void 0) {
          var option = _.findWhere(variable.options, { text: urlValue });
          option = option || { text: urlValue, value: urlValue };

          var promise = this.setVariableValue(variable, option, true);
          this.updateAutoInterval(variable);

          promises.push(promise);
        }
        else if (variable.refresh) {
          promises.push(this.updateOptions(variable));
        }
        else if (variable.type === 'interval') {
          this.updateAutoInterval(variable);
        }
      }

      return $q.all(promises);
    };

    this.updateAutoInterval = function(variable) {
      if (!variable.auto) { return; }

      // add auto option if missing
      if (variable.options[0].text !== 'auto') {
        variable.options.unshift({ text: 'auto', value: '$__auto_interval' });
      }

      var interval = kbn.calculateInterval(timeSrv.timeRange(), variable.auto_count);
      templateSrv.setGrafanaVariable('$__auto_interval', interval);
    };

    this.setVariableValue = function(variable, option, recursive) {
      variable.current = option;

      templateSrv.updateTemplateData();

      return this.updateOptionsInChildVariables(variable)
        .then(function() {
          if (!recursive) {
            $rootScope.$broadcast('refresh');
          }
        });
    };

    this.updateOptionsInChildVariables = function(updatedVariable) {
      var promises = _.map(self.variables, function(otherVariable) {
        if (otherVariable === updatedVariable) {
          return;
        }
        if (templateSrv.containsVariable(otherVariable.query, updatedVariable.name)) {
          return self.updateOptions(otherVariable);
        }
      });

      return $q.all(promises);
    };

    this._updateNonQueryVariable = function(variable) {
      // extract options in comma seperated string
      variable.options = _.map(variable.query.split(/[,]+/), function(text) {
        return { text: text.trim(), value: text.trim() };
      });

      if (variable.type === 'interval') {
        self.updateAutoInterval(variable);
      }
    };

    this.updateOptions = function(variable) {
      if (variable.type !== 'query') {
        self._updateNonQueryVariable(variable);
        self.setVariableValue(variable, variable.options[0]);
        return $q.when([]);
      }

      return datasourceSrv.get(variable.datasource).then(function(datasource) {
        return datasource.metricFindQuery(variable.query).then(function (results) {
          variable.options = self.metricNamesToVariableValues(variable, results);

          if (variable.includeAll) {
            self.addAllOption(variable);
          }

          // if parameter has current value
          // if it exists in options array keep value
          if (variable.current) {
            var currentOption = _.findWhere(variable.options, { text: variable.current.text });
            if (currentOption) {
              return self.setVariableValue(variable, currentOption, true);
            }
          }

          return self.setVariableValue(variable, variable.options[0], true);
        });
      });
    };

    this.metricNamesToVariableValues = function(variable, metricNames) {
      var regex, options, i, matches;
      options = {}; // use object hash to remove duplicates

      if (variable.regex) {
        regex = kbn.stringToJsRegex(templateSrv.replace(variable.regex));
      }

      for (i = 0; i < metricNames.length; i++) {
        var value = metricNames[i].text;

        if (regex) {
          matches = regex.exec(value);
          if (!matches) { continue; }
          if (matches.length > 1) {
            value = matches[1];
          }
        }

        options[value] = value;
      }

      return _.map(_.keys(options), function(key) {
        return { text: key, value: key };
      });
    };

    this.addAllOption = function(variable) {
      var allValue = '';
      switch(variable.allFormat) {
        case 'wildcard':
          allValue = '*';
          break;
        case 'regex wildcard':
          allValue = '.*';
          break;
        case 'regex values':
          allValue = '(' + _.pluck(variable.options, 'text').join('|') + ')';
          break;
        default:
          allValue = '{';
          allValue += _.pluck(variable.options, 'text').join(',');
          allValue += '}';
      }

      variable.options.unshift({text: 'All', value: allValue});
    };

  });

});
