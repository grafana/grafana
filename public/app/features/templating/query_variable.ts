///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {Variable, containsVariable} from './variable';
import {VariableSrv, variableConstructorMap} from './variable_srv';

function getNoneOption() {
  return { text: 'None', value: '', isNone: true };
}

export class QueryVariable implements Variable {
  datasource: any;
  query: any;
  regex: any;
  sort: any;
  options: any;
  current: any;
  includeAll: boolean;
  refresh: number;

  constructor(private model, private datasourceSrv, private templateSrv, private variableSrv, private $q)  {
    _.extend(this, model);
  }

  setValue(option){
    this.current = _.cloneDeep(option);

    if (_.isArray(this.current.text)) {
      this.current.text = this.current.text.join(' + ');
    }

    this.variableSrv.selectOptionsForCurrentValue(this);
    return this.variableSrv.variableUpdated(this);
  }

  setValueFromUrl(urlValue) {
    var promise = this.$q.when();

    if (this.refresh) {
      promise = this.updateOptions();
    }

    return promise.then(() => {
      var option = _.find(this.options, op => {
        return op.text === urlValue || op.value === urlValue;
      });

      option = option || { text: urlValue, value: urlValue };
      return this.setValue(option);
    });
  }

  updateOptions() {
    return this.datasourceSrv.get(this.datasource)
    .then(this.updateOptionsFromMetricFindQuery.bind(this))
    .then(() => {
      this.variableSrv.validateVariableSelectionState(this);
    });
  }

  updateOptionsFromMetricFindQuery(datasource) {
    return datasource.metricFindQuery(this.query).then(results => {
      this.options = this.metricNamesToVariableValues(results);
      if (this.includeAll) {
        this.addAllOption();
      }
      if (!this.options.length) {
        this.options.push(getNoneOption());
      }
      return datasource;
    });
  }

  addAllOption() {
    this.options.unshift({text: 'All', value: "$__all"});
  }

  metricNamesToVariableValues(metricNames) {
    var regex, options, i, matches;
    options = [];

    if (this.model.regex) {
      regex = kbn.stringToJsRegex(this.templateSrv.replace(this.regex));
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

      options.push({text: text, value: value});
    }

    options = _.uniq(options, 'value');
    return this.sortVariableValues(options, this.sort);
  }

  sortVariableValues(options, sortOrder) {
    if (sortOrder === 0) {
      return options;
    }

    var sortType = Math.ceil(sortOrder / 2);
    var reverseSort = (sortOrder % 2 === 0);

    if (sortType === 1) {
      options = _.sortBy(options, 'text');
    } else if (sortType === 2) {
      options = _.sortBy(options, function(opt) {
        var matches = opt.text.match(/.*?(\d+).*/);
if (!matches) {
  return 0;
} else {
  return parseInt(matches[1], 10);
}
      });
    }

    if (reverseSort) {
      options = options.reverse();
    }

    return options;
  }

  dependsOn(variableName) {
    return containsVariable(this.query, variableName) || containsVariable(this.datasource, variableName);
  }
}

variableConstructorMap['query'] = QueryVariable;
