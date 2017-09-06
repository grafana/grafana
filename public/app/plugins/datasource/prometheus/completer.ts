///<reference path="../../../headers/common.d.ts" />

import {PrometheusDatasource} from "./datasource";
import _ from 'lodash';

export class PromCompleter {
  labelNameCache: any;

  identifierRegexps = [/[\[\]a-zA-Z_0-9=]/];

  constructor(private datasource: PrometheusDatasource) {
    this.labelNameCache = {};
  }

  getCompletions(editor, session, pos, prefix, callback) {
    let token = session.getTokenAt(pos.row, pos.column);

    switch (token.type) {
      case 'label.name':
        var metricName = this.findMetricName(session, pos.row, pos.column);
        if (!metricName) {
          callback(null, this.transformToCompletions(['__name__', 'instance', 'job']));
          return;
        }

        if (this.labelNameCache[metricName]) {
          callback(null, this.labelNameCache[metricName]);
          return;
        }

        var op = '=~';
        if (/[a-zA-Z_:][a-zA-Z0-9_:]*/.test(metricName)) {
          op = '=';
        }
        var expr = '{__name__' + op + '"' + metricName + '"}';
        this.datasource.performInstantQuery({ expr: expr }, new Date().getTime() / 1000).then(response => {
          var labelNames = this.transformToCompletions(
            _.uniq(_.flatten(response.data.data.result.map(r => {
              return Object.keys(r.metric);
            })))
          );
          this.labelNameCache[metricName] = labelNames;
          callback(null, labelNames);
        });
        return;
      case 'label.value':
        callback(null, []);
        return;
    }

    if (prefix === '[') {
      var vectors = [];
      for (let unit of ['s', 'm', 'h']) {
        for (let value of [1,5,10,30]) {
         vectors.push({caption: value+unit, value: '['+value+unit, meta: 'range vector'});
        }
      }
      callback(null, vectors);
      return;
    }

    var query = prefix;
    var line = editor.session.getLine(pos.row);

    return this.datasource.performSuggestQuery(query, true).then(metricNames => {
      callback(null, metricNames.map(name => {
        let value = name;
        if (prefix === '(') {
          value = '(' + name;
        }

        return {
          caption: name,
          value: value,
          meta: 'metric',
        };
      }));
    });
  }

  transformToCompletions(words) {
    return words.map(name => {
      return {
        caption: name,
        value: name,
        meta: "label name",
        score: Number.MAX_VALUE
      };
    });
  }

  findMetricName(session, row, column) {
    var metricName = '';

    var tokens;
    var nameLabelNameToken = this.findToken(session, row, column, 'label.name', '__name__', 'paren.lparen');
    if (nameLabelNameToken) {
      tokens = session.getTokens(nameLabelNameToken.row);
      var nameLabelValueToken = tokens[nameLabelNameToken.index + 2];
      if (nameLabelValueToken && nameLabelValueToken.type === 'label.value') {
        metricName = nameLabelValueToken.value.slice(1, -1); // cut begin/end quotation
      }
    } else {
      var metricNameToken = this.findToken(session, row, column, 'identifier', null, null);
      if (metricNameToken) {
        tokens = session.getTokens(metricNameToken.row);
        if (tokens[metricNameToken.index + 1].type === 'paren.lparen') {
          metricName = metricNameToken.value;
        }
      }
    }

    return metricName;
  }

  findToken(session, row, column, target, value, guard) {
    var tokens, idx;
    for (var r = row; r >= 0; r--) {
      tokens = session.getTokens(r);
      if (r === row) { // current row
        var c = 0;
        for (idx = 0; idx < tokens.length; idx++) {
          c += tokens[idx].value.length;
          if (c >= column) {
            break;
          }
        }
      } else {
        idx = tokens.length - 1;
      }

      for (; idx >= 0; idx--) {
        if (tokens[idx].type === guard) {
          return null;
        }

        if (tokens[idx].type === target
          && (!value || tokens[idx].value === value)) {
          tokens[idx].row = r;
          tokens[idx].index = idx;
          return tokens[idx];
        }
      }
    }

    return null;
  }

}
