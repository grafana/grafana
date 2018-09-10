import kbn from 'app/core/utils/kbn';
import _ from 'lodash';

function luceneEscape(value) {
  return value.replace(/([\!\*\+\-\=<>\s\&\|\(\)\[\]\{\}\^\~\?\:\\/"])/g, '\\$1');
}

export class TemplateSrv {
  variables: any[];

  /*
   * This regex matches 3 types of variable reference with an optional format specifier
   * \$(\w+)                          $var1
   * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
   * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
   */
  private regex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?::(\w+))?}/g;
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

    for (let i = 0; i < this.variables.length; i++) {
      const variable = this.variables[i];

      if (!variable.current || (!variable.current.isNone && !variable.current.value)) {
        continue;
      }

      this.index[variable.name] = variable;
    }
  }

  variableInitialized(variable) {
    this.index[variable.name] = variable;
  }

  getAdhocFilters(datasourceName) {
    let filters = [];

    for (let i = 0; i < this.variables.length; i++) {
      const variable = this.variables[i];
      if (variable.type !== 'adhoc') {
        continue;
      }

      // null is the "default" datasource
      if (variable.datasource === null || variable.datasource === datasourceName) {
        filters = filters.concat(variable.filters);
      } else if (variable.datasource.indexOf('$') === 0) {
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
    if (value instanceof Array && value.length === 0) {
      return '__empty__';
    }
    const quotedValues = _.map(value, val => {
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

        const escapedValues = _.map(value, kbn.regexEscape);
        if (escapedValues.length === 1) {
          return escapedValues[0];
        }
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
      case 'csv': {
        if (_.isArray(value)) {
          return value.join(',');
        }
        return value;
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
    const match = this.regex.exec(expression);
    if (!match) {
      return null;
    }
    return match[1] || match[2];
  }

  variableExists(expression) {
    const name = this.getVariableName(expression);
    return name && this.index[name] !== void 0;
  }

  highlightVariablesAsHtml(str) {
    if (!str || !_.isString(str)) {
      return str;
    }

    str = _.escape(str);
    this.regex.lastIndex = 0;
    return str.replace(this.regex, (match, var1, var2, fmt2, var3) => {
      if (this.index[var1 || var2 || var3] || this.builtIns[var1 || var2 || var3]) {
        return '<span class="template-variable">' + match + '</span>';
      }
      return match;
    });
  }

  getAllValue(variable) {
    if (variable.allValue) {
      return variable.allValue;
    }
    const values = [];
    for (let i = 1; i < variable.options.length; i++) {
      values.push(variable.options[i].value);
    }
    return values;
  }

  replace(target, scopedVars?, format?) {
    if (!target) {
      return target;
    }

    let variable, systemValue, value, fmt;
    this.regex.lastIndex = 0;

    return target.replace(this.regex, (match, var1, var2, fmt2, var3, fmt3) => {
      variable = this.index[var1 || var2 || var3];
      fmt = fmt2 || fmt3 || format;
      if (scopedVars) {
        value = scopedVars[var1 || var2 || var3];
        if (value) {
          return this.formatValue(value.value, fmt, variable);
        }
      }

      if (!variable) {
        return match;
      }

      systemValue = this.grafanaVariables[variable.current.value];
      if (systemValue) {
        return this.formatValue(systemValue, fmt, variable);
      }

      value = variable.current.value;
      if (this.isAllValue(value)) {
        value = this.getAllValue(variable);
        // skip formatting of custom all values
        if (variable.allValue) {
          return this.replace(value);
        }
      }

      const res = this.formatValue(value, fmt, variable);
      return res;
    });
  }

  isAllValue(value) {
    return value === '$__all' || (Array.isArray(value) && value[0] === '$__all');
  }

  replaceWithText(target, scopedVars) {
    if (!target) {
      return target;
    }

    let variable;
    this.regex.lastIndex = 0;

    return target.replace(this.regex, (match, var1, var2, fmt2, var3) => {
      if (scopedVars) {
        const option = scopedVars[var1 || var2 || var3];
        if (option) {
          return option.text;
        }
      }

      variable = this.index[var1 || var2 || var3];
      if (!variable) {
        return match;
      }

      return this.grafanaVariables[variable.current.value] || variable.current.text;
    });
  }

  fillVariableValuesForUrl(params, scopedVars) {
    _.each(this.variables, variable => {
      if (scopedVars && scopedVars[variable.name] !== void 0) {
        if (scopedVars[variable.name].skipUrlSync) {
          return;
        }
        params['var-' + variable.name] = scopedVars[variable.name].value;
      } else {
        if (variable.skipUrlSync) {
          return;
        }
        params['var-' + variable.name] = variable.getValueForUrl();
      }
    });
  }

  distributeVariable(value, variable) {
    value = _.map(value, (val, index) => {
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
