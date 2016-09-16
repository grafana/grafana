///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {Variable} from './variable';
import {VariableSrv, variableConstructorMap} from './variable_srv';

export class DatasourceVariable implements Variable {
  regex: any;
  query: string;
  options: any;

  /** @ngInject */
  constructor(private model, private datasourceSrv) {
    _.extend(this, model);
  }

  setValue(option) {
  }

  updateOptions() {
    var options = [];
    var sources = this.datasourceSrv.getMetricSources({skipVariables: true});
    var regex;

    if (this.regex) {
      regex = kbn.stringToJsRegex(this.regex);
    }

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      // must match on type
      if (source.meta.id !== this.query) {
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

    this.options = options;
  }

  dependsOn(variableName) {
    return false;
  }
}

variableConstructorMap['datasource'] = DatasourceVariable;
