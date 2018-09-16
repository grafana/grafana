import { PrometheusDatasource } from './datasource';
import _ from 'lodash';

export class PromCompleter {
  labelQueryCache: any;
  labelNameCache: any;
  labelValueCache: any;
  templateVariableCompletions: any;

  identifierRegexps = [/\[/, /[a-zA-Z0-9_:]/];

  constructor(private datasource: PrometheusDatasource, private templateSrv) {
    this.labelQueryCache = {};
    this.labelNameCache = {};
    this.labelValueCache = {};
    this.templateVariableCompletions = this.templateSrv.variables.map(variable => {
      return {
        caption: '$' + variable.name,
        value: '$' + variable.name,
        meta: 'variable',
        score: Number.MAX_VALUE,
      };
    });
  }

  getCompletions(editor, session, pos, prefix, callback) {
    const wrappedCallback = (err, completions) => {
      completions = completions.concat(this.templateVariableCompletions);
      return callback(err, completions);
    };

    const token = session.getTokenAt(pos.row, pos.column);

    switch (token.type) {
      case 'entity.name.tag.label-matcher':
        this.getCompletionsForLabelMatcherName(session, pos).then(completions => {
          wrappedCallback(null, completions);
        });
        return;
      case 'string.quoted.label-matcher':
        this.getCompletionsForLabelMatcherValue(session, pos).then(completions => {
          wrappedCallback(null, completions);
        });
        return;
      case 'entity.name.tag.label-list-matcher':
        this.getCompletionsForBinaryOperator(session, pos).then(completions => {
          wrappedCallback(null, completions);
        });
        return;
    }

    if (token.type === 'paren.lparen' && token.value === '[') {
      const vectors = [];
      for (const unit of ['s', 'm', 'h']) {
        for (const value of [1, 5, 10, 30]) {
          vectors.push({
            caption: value + unit,
            value: '[' + value + unit,
            meta: 'range vector',
          });
        }
      }

      vectors.unshift({
        caption: '$__interval_ms',
        value: '[$__interval_ms',
        meta: 'range vector',
      });

      vectors.unshift({
        caption: '$__interval',
        value: '[$__interval',
        meta: 'range vector',
      });

      wrappedCallback(null, vectors);
      return;
    }

    const query = prefix;

    return this.datasource.performSuggestQuery(query, true).then(metricNames => {
      wrappedCallback(
        null,
        metricNames.map(name => {
          let value = name;
          if (prefix === '(') {
            value = '(' + name;
          }

          return {
            caption: name,
            value: value,
            meta: 'metric',
          };
        })
      );
    });
  }

  getCompletionsForLabelMatcherName(session, pos) {
    const metricName = this.findMetricName(session, pos.row, pos.column);
    if (!metricName) {
      return Promise.resolve(this.transformToCompletions(['__name__', 'instance', 'job'], 'label name'));
    }

    if (this.labelNameCache[metricName]) {
      return Promise.resolve(this.labelNameCache[metricName]);
    }

    return this.getLabelNameAndValueForExpression(metricName, 'metricName').then(result => {
      const labelNames = this.transformToCompletions(
        _.uniq(
          _.flatten(
            result.map(r => {
              return Object.keys(r);
            })
          )
        ),
        'label name'
      );
      this.labelNameCache[metricName] = labelNames;
      return Promise.resolve(labelNames);
    });
  }

  getCompletionsForLabelMatcherValue(session, pos) {
    const metricName = this.findMetricName(session, pos.row, pos.column);
    if (!metricName) {
      return Promise.resolve([]);
    }

    const labelNameToken = this.findToken(
      session,
      pos.row,
      pos.column,
      'entity.name.tag.label-matcher',
      null,
      'paren.lparen.label-matcher'
    );
    if (!labelNameToken) {
      return Promise.resolve([]);
    }
    const labelName = labelNameToken.value;

    if (this.labelValueCache[metricName] && this.labelValueCache[metricName][labelName]) {
      return Promise.resolve(this.labelValueCache[metricName][labelName]);
    }

    return this.getLabelNameAndValueForExpression(metricName, 'metricName').then(result => {
      const labelValues = this.transformToCompletions(
        _.uniq(
          result.map(r => {
            return r[labelName];
          })
        ),
        'label value'
      );
      this.labelValueCache[metricName] = this.labelValueCache[metricName] || {};
      this.labelValueCache[metricName][labelName] = labelValues;
      return Promise.resolve(labelValues);
    });
  }

  getCompletionsForBinaryOperator(session, pos) {
    const keywordOperatorToken = this.findToken(session, pos.row, pos.column, 'keyword.control', null, 'identifier');
    if (!keywordOperatorToken) {
      return Promise.resolve([]);
    }
    let rparenToken, expr;
    switch (keywordOperatorToken.value) {
      case 'by':
      case 'without':
        rparenToken = this.findToken(
          session,
          keywordOperatorToken.row,
          keywordOperatorToken.column,
          'paren.rparen',
          null,
          'identifier'
        );
        if (!rparenToken) {
          return Promise.resolve([]);
        }
        expr = this.findExpressionMatchedParen(session, rparenToken.row, rparenToken.column);
        if (expr === '') {
          return Promise.resolve([]);
        }
        return this.getLabelNameAndValueForExpression(expr, 'expression').then(result => {
          const labelNames = this.transformToCompletions(
            _.uniq(
              _.flatten(
                result.map(r => {
                  return Object.keys(r);
                })
              )
            ),
            'label name'
          );
          this.labelNameCache[expr] = labelNames;
          return labelNames;
        });
      case 'on':
      case 'ignoring':
      case 'group_left':
      case 'group_right':
        const binaryOperatorToken = this.findToken(
          session,
          keywordOperatorToken.row,
          keywordOperatorToken.column,
          'keyword.operator.binary',
          null,
          'identifier'
        );
        if (!binaryOperatorToken) {
          return Promise.resolve([]);
        }
        rparenToken = this.findToken(
          session,
          binaryOperatorToken.row,
          binaryOperatorToken.column,
          'paren.rparen',
          null,
          'identifier'
        );
        if (rparenToken) {
          expr = this.findExpressionMatchedParen(session, rparenToken.row, rparenToken.column);
          if (expr === '') {
            return Promise.resolve([]);
          }
          return this.getLabelNameAndValueForExpression(expr, 'expression').then(result => {
            const labelNames = this.transformToCompletions(
              _.uniq(
                _.flatten(
                  result.map(r => {
                    return Object.keys(r);
                  })
                )
              ),
              'label name'
            );
            this.labelNameCache[expr] = labelNames;
            return labelNames;
          });
        } else {
          const metricName = this.findMetricName(session, binaryOperatorToken.row, binaryOperatorToken.column);
          return this.getLabelNameAndValueForExpression(metricName, 'metricName').then(result => {
            const labelNames = this.transformToCompletions(
              _.uniq(
                _.flatten(
                  result.map(r => {
                    return Object.keys(r);
                  })
                )
              ),
              'label name'
            );
            this.labelNameCache[metricName] = labelNames;
            return Promise.resolve(labelNames);
          });
        }
    }

    return Promise.resolve([]);
  }

  getLabelNameAndValueForExpression(expr: string, type: string): Promise<any> {
    if (this.labelQueryCache[expr]) {
      return Promise.resolve(this.labelQueryCache[expr]);
    }
    let query = expr;
    if (type === 'metricName') {
      let op = '=~';
      if (/[a-zA-Z_:][a-zA-Z0-9_:]*/.test(expr)) {
        op = '=';
      }
      query = '{__name__' + op + '"' + expr + '"}';
    }
    const { start, end } = this.datasource.getTimeRange();
    const url = '/api/v1/series?match[]=' + encodeURIComponent(query) + '&start=' + start + '&end=' + end;
    return this.datasource.metadataRequest(url).then(response => {
      this.labelQueryCache[expr] = response.data.data;
      return response.data.data;
    });
  }

  transformToCompletions(words, meta) {
    return words.map(name => {
      return {
        caption: name,
        value: name,
        meta: meta,
        score: Number.MAX_VALUE,
      };
    });
  }

  findMetricName(session, row, column) {
    let metricName = '';

    let tokens;
    const nameLabelNameToken = this.findToken(
      session,
      row,
      column,
      'entity.name.tag.label-matcher',
      '__name__',
      'paren.lparen.label-matcher'
    );
    if (nameLabelNameToken) {
      tokens = session.getTokens(nameLabelNameToken.row);
      const nameLabelValueToken = tokens[nameLabelNameToken.index + 2];
      if (nameLabelValueToken && nameLabelValueToken.type === 'string.quoted.label-matcher') {
        metricName = nameLabelValueToken.value.slice(1, -1); // cut begin/end quotation
      }
    } else {
      const metricNameToken = this.findToken(session, row, column, 'identifier', null, null);
      if (metricNameToken) {
        tokens = session.getTokens(metricNameToken.row);
        metricName = metricNameToken.value;
      }
    }

    return metricName;
  }

  findToken(session, row, column, target, value, guard) {
    let tokens, idx;
    // find index and get column of previous token
    for (let r = row; r >= 0; r--) {
      let c;
      tokens = session.getTokens(r);
      if (r === row) {
        // current row
        c = 0;
        for (idx = 0; idx < tokens.length; idx++) {
          const nc = c + tokens[idx].value.length;
          if (nc >= column) {
            break;
          }
          c = nc;
        }
      } else {
        idx = tokens.length - 1;
        c =
          _.sum(
            tokens.map(t => {
              return t.value.length;
            })
          ) - tokens[tokens.length - 1].value.length;
      }

      for (; idx >= 0; idx--) {
        if (tokens[idx].type === guard) {
          return null;
        }

        if (tokens[idx].type === target && (!value || tokens[idx].value === value)) {
          tokens[idx].row = r;
          tokens[idx].column = c;
          tokens[idx].index = idx;
          return tokens[idx];
        }
        c -= tokens[idx].value.length;
      }
    }

    return null;
  }

  findExpressionMatchedParen(session, row, column) {
    let tokens, idx;
    let deep = 1;
    let expression = ')';
    for (let r = row; r >= 0; r--) {
      tokens = session.getTokens(r);
      if (r === row) {
        // current row
        let c = 0;
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
        expression = tokens[idx].value + expression;
        if (tokens[idx].type === 'paren.rparen') {
          deep++;
        } else if (tokens[idx].type === 'paren.lparen') {
          deep--;
          if (deep === 0) {
            return expression;
          }
        }
      }
    }

    return expression;
  }
}
