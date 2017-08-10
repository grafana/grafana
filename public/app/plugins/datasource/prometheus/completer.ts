///<reference path="../../../headers/common.d.ts" />

import {PrometheusDatasource} from "./datasource";

export class PromCompleter {
  identifierRegexps = [/[\[\]a-zA-Z_0-9=]/];

  constructor(private datasource: PrometheusDatasource) {
  }

  getCompletions(editor, session, pos, prefix, callback) {
    var query = prefix;
    return this.datasource.performSuggestQuery(query).then(metricNames => {
      callback(null, metricNames.map(name => {
        return {
          caption: name,
          value: name,
          meta: 'metric',
        };
      }));
    });
  }

}
