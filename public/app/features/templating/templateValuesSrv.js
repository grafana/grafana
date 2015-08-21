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

    function getNoneOption() { return { text: 'None', value: '', isNone: true }; }

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
      variable.current = angular.copy(option);

      if (_.isArray(variable.current.value)) {
        variable.current.text = variable.current.value.join(' + ');
      }

      self.selectOptionsForCurrentValue(variable);

      templateSrv.updateTemplateData();
      return self.updateOptionsInChildVariables(variable);
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

      return datasourceSrv.get(variable.datasource)
        .then(_.partial(this.updateOptionsFromMetricFindQuery, variable))
        .then(_.partial(this.updateTags, variable))
        .then(_.partial(this.validateVariableSelectionState, variable));
    };

    this.selectOptionsForCurrentValue = function(variable) {
      var i, y, value, option;

      for (i = 0; i < variable.options.length; i++) {
        option = variable.options[i];
        option.selected = false;
        if (_.isArray(variable.current.value)) {
          for (y = 0; y < variable.current.value.length; y++) {
            value = variable.current.value[y];
            if (option.value === value) {
              option.selected = true;
            }
          }
        } else if (option.value === variable.current.value) {
          option.selected = true;
        }
      }
    };

    this.validateVariableSelectionState = function(variable) {
      if (!variable.current) {
        if (!variable.options.length) { return; }
        return self.setVariableValue(variable, variable.options[0]);
      }

      if (_.isArray(variable.current.value)) {
        self.selectOptionsForCurrentValue(variable);
      } else {
        var currentOption = _.findWhere(variable.options, { text: variable.current.text });
        if (currentOption) {
          return self.setVariableValue(variable, currentOption);
        } else {
          if (!variable.options.length) { return; }
          return self.setVariableValue(variable, variable.options[0]);
        }
      }
    };

    this.updateTags = function(variable, datasource) {
      if (variable.useTags) {
        return datasource.metricFindQuery(variable.tagsQuery).then(function (results) {
          variable.tags = [];
          for (var i = 0; i < results.length; i++) {
            variable.tags.push(results[i].text);
          }
          return datasource;
        });
      } else {
        delete variable.tags;
      }

      return datasource;
    };

    this.updateOptionsFromMetricFindQuery = function(variable, datasource) {
      return datasource.metricFindQuery(variable.query).then(function (results) {
        variable.options = self.metricNamesToVariableValues(variable, results);
        if (variable.includeAll) {
          self.addAllOption(variable);
        }
        if (!variable.options.length) {
          variable.options.push(getNoneOption());
        }
        return datasource;
      });
    };

    this.getValuesForTag = function(variable, tagKey) {
      return datasourceSrv.get(variable.datasource).then(function(datasource) {
        var query = variable.tagValuesQuery.replace('$tag', tagKey);
        return datasource.metricFindQuery(query).then(function (results) {
          return _.map(results, function(value) {
            return value.text;
          });
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

      return _.map(_.keys(options).sort(), function(key) {
        var option = { text: key, value: key };

        // check if values need to be regex escaped
        if (self.shouldRegexEscape(variable)) {
          option.value = self.regexEscape(option.value);
        }

        return option;
      });
    };

    this.shouldRegexEscape = function(variable) {
      return (variable.includeAll || variable.multi) && variable.allFormat.indexOf('regex') !== -1;
    };

    this.regexEscape = function(value) {
      return value.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
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
        allValue = '(' + _.map(variable.options, function(option) {
          return self.regexEscape(option.text);
        }).join('|') + ')';
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
