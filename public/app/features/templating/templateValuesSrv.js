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
          promises.push(this.setVariableFromUrl(variable, urlValue));
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

    this.setVariableFromUrl = function(variable, urlValue) {
      if (variable.refresh) {
        var self = this;
        //refresh the list of options before setting the value
        return this.updateOptions(variable).then(function() {
          var option = _.findWhere(variable.options, { text: urlValue });
          option = option || { text: urlValue, value: urlValue };

          self.updateAutoInterval(variable);
          return self.setVariableValue(variable, option);
        });
      }
      var option = _.findWhere(variable.options, { text: urlValue });
      option = option || { text: urlValue, value: urlValue };

      if (_.isArray(urlValue)) {
        option.text = urlValue.join(', ');
      }

      this.updateAutoInterval(variable);
      return this.setVariableValue(variable, option);
    };

    this.updateAutoInterval = function(variable) {
      if (!variable.auto) { return; }

      // add auto option if missing
      if (variable.options.length && variable.options[0].text !== 'auto') {
        variable.options.unshift({ text: 'auto', value: '$__auto_interval' });
      }

      var interval = kbn.calculateInterval(timeSrv.timeRange(), variable.auto_count);
      templateSrv.setGrafanaVariable('$__auto_interval', interval);
    };

    this.setVariableValue = function(variable, option) {
      variable.current = option;
      templateSrv.updateTemplateData();
      return this.updateOptionsInChildVariables(variable);
    };

    this.variableUpdated = function(variable) {
      templateSrv.updateTemplateData();
      return this.updateOptionsInChildVariables(variable);
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
        var queryPromise = datasource.metricFindQuery(variable.query).then(function (results) {
          variable.options = self.metricNamesToVariableValues(variable, results);

          if (variable.includeAll) {
            self.addAllOption(variable);
          }

          // if parameter has current value
          // if it exists in options array keep value
          if (variable.current) {
            var currentOption = _.findWhere(variable.options, { text: variable.current.text });
            if (currentOption) {
              return self.setVariableValue(variable, currentOption);
            }
          }

          return self.setVariableValue(variable, variable.options[0]);
        });

        if (variable.useTags) {
          return queryPromise.then(function() {
            datasource.metricFindQuery(variable.tagsQuery).then(function (results) {
              variable.tags = [];
              for (var i = 0; i < results.length; i++) {
                variable.tags.push(results[i].text);
              }
            });
          });
        } else {
          return queryPromise;
        }
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
