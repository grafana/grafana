define([
  'angular',
  'lodash',
  'app/core/utils/kbn',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateValuesSrv', function($q, $rootScope, datasourceSrv, $location, templateSrv, timeSrv) {
    var self = this;

    function getNoneOption() { return { text: 'None', value: '', isNone: true }; }

    // update time variant variables
    $rootScope.onAppEvent('refresh', function() {

      // look for interval variables
      var intervalVariable = _.findWhere(self.variables, { type: 'interval' });
      if (intervalVariable) {
        self.updateAutoInterval(intervalVariable);
      }

      // update variables with refresh === 2
      var promises = self.variables
        .filter(function(variable) {
          return variable.refresh === 2;
        }).map(function(variable) {
          return self.updateOptions(variable);
        });

      return $q.all(promises);

    }, $rootScope);

    this.init = function(dashboard) {
      this.variables = dashboard.templating.list;
      templateSrv.init(this.variables);

      var queryParams = $location.search();
      var promises = [];

      // use promises to delay processing variables that
      // depend on other variables.
      this.variableLock = {};
      _.forEach(this.variables, function(variable) {
        self.variableLock[variable.name] = $q.defer();
      });

      for (var i = 0; i < this.variables.length; i++) {
        var variable = this.variables[i];
        promises.push(this.processVariable(variable, queryParams));
      }

      return $q.all(promises);
    };

    this.processVariable = function(variable, queryParams) {
      var dependencies = [];
      var lock = self.variableLock[variable.name];

      // determine our dependencies.
      if (variable.type === "query") {
        _.forEach(this.variables, function(v) {
          // both query and datasource can contain variable
          if (templateSrv.containsVariable(variable.query, v.name) ||
              templateSrv.containsVariable(variable.datasource, v.name)) {
            dependencies.push(self.variableLock[v.name].promise);
          }
        });
      }

      return $q.all(dependencies).then(function() {
        var urlValue = queryParams['var-' + variable.name];
        if (urlValue !== void 0) {
          return self.setVariableFromUrl(variable, urlValue).then(lock.resolve);
        }
        else if (variable.refresh === 1 || variable.refresh === 2) {
          return self.updateOptions(variable).then(function() {
            if (_.isEmpty(variable.current) && variable.options.length) {
              self.setVariableValue(variable, variable.options[0]);
            }
            lock.resolve();
          });
        }
        else if (variable.type === 'interval') {
          self.updateAutoInterval(variable);
          lock.resolve();
        } else {
          lock.resolve();
        }
      });
    };

    this.setVariableFromUrl = function(variable, urlValue) {
      var promise = $q.when(true);

      if (variable.refresh) {
        promise = this.updateOptions(variable);
      }

      return promise.then(function() {
        var option = _.find(variable.options, function(op) {
          return op.text === urlValue || op.value === urlValue;
        });

        option = option || { text: urlValue, value: urlValue };

        self.updateAutoInterval(variable);
        return self.setVariableValue(variable, option, true);
      });
    };

    this.updateAutoInterval = function(variable) {
      if (!variable.auto) { return; }

      // add auto option if missing
      if (variable.options.length && variable.options[0].text !== 'auto') {
        variable.options.unshift({ text: 'auto', value: '$__auto_interval' });
      }

      var interval = kbn.calculateInterval(timeSrv.timeRange(), variable.auto_count, (variable.auto_min ? ">"+variable.auto_min : null));
      templateSrv.setGrafanaVariable('$__auto_interval', interval);
    };

    this.setVariableValue = function(variable, option, initPhase) {
      variable.current = angular.copy(option);

      if (_.isArray(variable.current.text)) {
        variable.current.text = variable.current.text.join(' + ');
      }

      self.selectOptionsForCurrentValue(variable);
      templateSrv.updateTemplateData();

      // on first load, variable loading is ordered to ensure
      // that parents are updated before children.
      if (initPhase) {
        return $q.when();
      }

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
        if (templateSrv.containsVariable(otherVariable.query, updatedVariable.name) ||
            templateSrv.containsVariable(otherVariable.datasource, updatedVariable.name)) {
          return self.updateOptions(otherVariable);
        }
      });

      return $q.all(promises);
    };

    this._updateNonQueryVariable = function(variable) {
      if (variable.type === 'datasource') {
        self.updateDataSourceVariable(variable);
        return;
      }

      if (variable.type === 'constant') {
        variable.options = [{text: variable.query, value: variable.query}];
        return;
      }

      // extract options in comma separated string
      variable.options = _.map(variable.query.split(/[,]+/), function(text) {
        return { text: text.trim(), value: text.trim() };
      });

      if (variable.type === 'interval') {
        self.updateAutoInterval(variable);
        return;
      }

      if (variable.type === 'custom' && variable.includeAll) {
        self.addAllOption(variable);
      }
    };

    this.updateDataSourceVariable = function(variable) {
      var options = [];
      var sources = datasourceSrv.getMetricSources({skipVariables: true});
      var regex;

      if (variable.regex) {
        regex = kbn.stringToJsRegex(templateSrv.replace(variable.regex));
      }

      for (var i = 0; i < sources.length; i++) {
        var source = sources[i];
        // must match on type
        if (source.meta.id !== variable.query) {
          continue;
        }

        if (regex && !regex.exec(source.name)) {
          continue;
        }

        options.push({text: source.name, value: source.name});
      }

      if (options.length === 0) {
        options.push({text: 'No data sources found', value: ''});
      }

      variable.options = options;
    };

    this.updateOptions = function(variable) {
      if (variable.type !== 'query') {
        self._updateNonQueryVariable(variable);
        return self.validateVariableSelectionState(variable);
      }

      return datasourceSrv.get(variable.datasource)
        .then(_.partial(this.updateOptionsFromMetricFindQuery, variable))
        .then(_.partial(this.updateTags, variable))
        .then(_.partial(this.validateVariableSelectionState, variable));
    };

    this.selectOptionsForCurrentValue = function(variable) {
      var i, y, value, option;
      var selected = [];

      for (i = 0; i < variable.options.length; i++) {
        option = variable.options[i];
        option.selected = false;
        if (_.isArray(variable.current.value)) {
          for (y = 0; y < variable.current.value.length; y++) {
            value = variable.current.value[y];
            if (option.value === value) {
              option.selected = true;
              selected.push(option);
            }
          }
        } else if (option.value === variable.current.value) {
          option.selected = true;
          selected.push(option);
        }
      }

      return selected;
    };

    this.validateVariableSelectionState = function(variable) {
      if (!variable.current) {
        if (!variable.options.length) { return; }
        return self.setVariableValue(variable, variable.options[0], false);
      }

      if (_.isArray(variable.current.value)) {
        var selected = self.selectOptionsForCurrentValue(variable);

        // if none pick first
        if (selected.length === 0) {
          selected = variable.options[0];
        } else {
          selected = {
            value: _.map(selected, function(val) {return val.value;}),
            text: _.map(selected, function(val) {return val.text;}).join(' + '),
          };
        }

        return self.setVariableValue(variable, selected, false);
      } else {
        var currentOption = _.findWhere(variable.options, {text: variable.current.text});
        if (currentOption) {
          return self.setVariableValue(variable, currentOption, false);
        } else {
          if (!variable.options.length) { return $q.when(null); }
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
        var item = metricNames[i];
        var value = item.value || item.text;
        var text = item.text || item.value;

        if (_.isNumber(value)) {
          value = value.toString();
        }

        if (_.isNumber(text)) {
          text = text.toString();
        }

        if (regex) {
          matches = regex.exec(value);
          if (!matches) { continue; }
          if (matches.length > 1) {
            value = matches[1];
            text = value;
          }
        }

        options[value] = {text: text, value: value};
      }

      return _.sortBy(options, 'text');
    };

    this.addAllOption = function(variable) {
      variable.options.unshift({text: 'All', value: "$__all"});
    };

  });

});
