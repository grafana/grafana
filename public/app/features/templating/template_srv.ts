import kbn from 'app/core/utils/kbn';
import _ from 'lodash';

function luceneEscape(value) {
  return value.replace(
    /([\!\*\+\-\=<>\s\&\|\(\)\[\]\{\}\^\~\?\:\\/"])/g,
    '\\$1'
  );
}

export class TemplateSrv {
  variables: any[];

  private regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
  private index = {};
  private grafanaVariables = {};
  private builtIns = {};

  constructor() {
    this.builtIns['__interval'] = { text: '1s', value: '1s' };
    this.builtIns['__interval_ms'] = { text: '100', value: '100' };
  }

  init(variables) {
    this.variables = variables;
    this.updateTemplateData();
  }

  updateTemplateData() {
    this.index = {};

    for (var i = 0; i < this.variables.length; i++) {
      var variable = this.variables[i];

      if (
        !variable.current ||
        (!variable.current.isNone && !variable.current.value)
      ) {
        continue;
      }

      this.index[variable.name] = variable;
    }
  }

  variableInitialized(variable) {
    this.index[variable.name] = variable;
  }

  getAdhocFilters(datasourceName) {
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
  }

  luceneFormat(value) {
    if (typeof value === 'string') {
      return luceneEscape(value);
    }
    var quotedValues = _.map(value, function(val) {
      return '"' + luceneEscape(val) + '"';
    });
    return '(' + quotedValues.join(' OR ') + ')';
  }

  formatValue(value, format, variable) {
    // for some scopedVars there is no variable
    variable = variable || {};

    if (typeof format === 'function') {
      return format(value, variable, this.formatValue);
    }

    switch (format) {
      case 'regex': {
        if (typeof value === 'string') {
          return kbn.regexEscape(value);
        }

        var escapedValues = _.map(value, kbn.regexEscape);
        return '(' + escapedValues.join('|') + ')';
      }
      case 'lucene': {
        return this.luceneFormat(value);
      }
      case 'pipe': {
        if (typeof value === 'string') {
          return value;
        }
        return value.join('|');
      }
      case 'distributed': {
        if (typeof value === 'string') {
          return value;
        }
        return this.distributeVariable(value, variable.name);
      }
      default: {
        if (_.isArray(value)) {
          return '{' + value.join(',') + '}';
        }
        return value;
      }
    }
  }

  setGrafanaVariable(name, value) {
    this.grafanaVariables[name] = value;
  }

  getVariableName(expression) {
    this.regex.lastIndex = 0;
    var match = this.regex.exec(expression);
    if (!match) {
      return null;
    }
    return match[1] || match[2];
  }

  variableExists(expression) {
    var name = this.getVariableName(expression);
    return name && this.index[name] !== void 0;
  }

  highlightVariablesAsHtml(str) {
    if (!str || !_.isString(str)) {
      return str;
    }

    str = _.escape(str);
    this.regex.lastIndex = 0;
    return str.replace(this.regex, (match, g1, g2) => {
      if (this.index[g1 || g2] || this.builtIns[g1 || g2]) {
        return '<span class="template-variable">' + match + '</span>';
      }
      return match;
    });
  }

  getAllValue(variable) {
    if (variable.allValue) {
      return variable.allValue;
    }
    var values = [];
    for (var i = 1; i < variable.options.length; i++) {
      values.push(variable.options[i].value);
    }
    return values;
  }

  replace(target, scopedVars?, format?) {
    if (!target) {
      return target;
    }

    var variable, systemValue, value;
    this.regex.lastIndex = 0;

    return target.replace(this.regex, (match, g1, g2) => {
      variable = this.index[g1 || g2];

      if (scopedVars) {
        value = scopedVars[g1 || g2];
        if (value) {
          return this.formatValue(value.value, format, variable);
        }
      }

      if (!variable) {
        return match;
      }

      systemValue = this.grafanaVariables[variable.current.value];
      if (systemValue) {
        return this.formatValue(systemValue, format, variable);
      }

      value = variable.current.value;
      if (this.isAllValue(value)) {
        value = this.getAllValue(variable);
        // skip formating of custom all values
        if (variable.allValue) {
          return value;
        }
      }

      var res = this.formatValue(value, format, variable);
      return res;
    });
  }

  isAllValue(value) {
    return (
      value === '$__all' || (Array.isArray(value) && value[0] === '$__all')
    );
  }

  replaceWithText(target, scopedVars) {
    if (!target) {
      return target;
    }

    var variable;
    this.regex.lastIndex = 0;

    return target.replace(this.regex, (match, g1, g2) => {
      if (scopedVars) {
        var option = scopedVars[g1 || g2];
        if (option) {
          return option.text;
        }
      }

      variable = this.index[g1 || g2];
      if (!variable) {
        return match;
      }

      return (
        this.grafanaVariables[variable.current.value] || variable.current.text
      );
    });
  }

  fillVariableValuesForUrl(params, scopedVars) {
    _.each(this.variables, function(variable) {
      if (scopedVars && scopedVars[variable.name] !== void 0) {
        params['var-' + variable.name] = scopedVars[variable.name].value;
      } else {
        params['var-' + variable.name] = variable.getValueForUrl();
      }
    });
  }

  distributeVariable(value, variable) {
    value = _.map(value, function(val, index) {
      if (index !== 0) {
        return variable + '=' + val;
      } else {
        return val;
      }
    });
    return value.join(',');
  }
}

export default new TemplateSrv();
