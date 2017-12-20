///<reference path="../../../headers/common.d.ts" />

import { PrometheusDatasource } from "./datasource";
import _ from "lodash";

export class PromCompleter {
  labelQueryCache: any;
  labelNameCache: any;
  labelValueCache: any;

  identifierRegexps = [/\[/, /[a-zA-Z0-9_:]/];

  constructor(private datasource: PrometheusDatasource) {
    this.labelQueryCache = {};
    this.labelNameCache = {};
    this.labelValueCache = {};
  }

  getCompletions(editor, session, pos, prefix, callback) {
    let token = session.getTokenAt(pos.row, pos.column);

    var metricName;
    switch (token.type) {
      case "entity.name.tag":
        metricName = this.findMetricName(session, pos.row, pos.column);
        if (!metricName) {
          callback(
            null,
            this.transformToCompletions(
              ["__name__", "instance", "job"],
              "label name"
            )
          );
          return;
        }

        if (this.labelNameCache[metricName]) {
          callback(null, this.labelNameCache[metricName]);
          return;
        }

        return this.getLabelNameAndValueForMetric(metricName).then(result => {
          var labelNames = this.transformToCompletions(
            _.uniq(
              _.flatten(
                result.map(r => {
                  return Object.keys(r.metric);
                })
              )
            ),
            "label name"
          );
          this.labelNameCache[metricName] = labelNames;
          callback(null, labelNames);
        });
      case "string.quoted":
        metricName = this.findMetricName(session, pos.row, pos.column);
        if (!metricName) {
          callback(null, []);
          return;
        }

        var labelNameToken = this.findToken(
          session,
          pos.row,
          pos.column,
          "entity.name.tag",
          null,
          "paren.lparen"
        );
        if (!labelNameToken) {
          callback(null, []);
          return;
        }
        var labelName = labelNameToken.value;

        if (
          this.labelValueCache[metricName] &&
          this.labelValueCache[metricName][labelName]
        ) {
          callback(null, this.labelValueCache[metricName][labelName]);
          return;
        }

        return this.getLabelNameAndValueForMetric(metricName).then(result => {
          var labelValues = this.transformToCompletions(
            _.uniq(
              result.map(r => {
                return r.metric[labelName];
              })
            ),
            "label value"
          );
          this.labelValueCache[metricName] =
            this.labelValueCache[metricName] || {};
          this.labelValueCache[metricName][labelName] = labelValues;
          callback(null, labelValues);
        });
    }

    if (token.type === "paren.lparen" && token.value === "[") {
      var vectors = [];
      for (let unit of ["s", "m", "h"]) {
        for (let value of [1, 5, 10, 30]) {
          vectors.push({
            caption: value + unit,
            value: "[" + value + unit,
            meta: "range vector"
          });
        }
      }
      vectors.push({
        caption: "$__interval",
        value: "[$__interval",
        meta: "range vector"
      });
      vectors.push({
        caption: "$__interval_ms",
        value: "[$__interval_ms",
        meta: "range vector"
      });
      callback(null, vectors);
      return;
    }

    var query = prefix;

    return this.datasource
      .performSuggestQuery(query, true)
      .then(metricNames => {
        callback(
          null,
          metricNames.map(name => {
            let value = name;
            if (prefix === "(") {
              value = "(" + name;
            }

            return {
              caption: name,
              value: value,
              meta: "metric"
            };
          })
        );
      });
  }

  getLabelNameAndValueForMetric(metricName) {
    if (this.labelQueryCache[metricName]) {
      return Promise.resolve(this.labelQueryCache[metricName]);
    }
    var op = "=~";
    if (/[a-zA-Z_:][a-zA-Z0-9_:]*/.test(metricName)) {
      op = "=";
    }
    var expr = "{__name__" + op + '"' + metricName + '"}';
    return this.datasource
      .performInstantQuery({ expr: expr }, new Date().getTime() / 1000)
      .then(response => {
        this.labelQueryCache[metricName] = response.data.data.result;
        return response.data.data.result;
      });
  }

  transformToCompletions(words, meta) {
    return words.map(name => {
      return {
        caption: name,
        value: name,
        meta: meta,
        score: Number.MAX_VALUE
      };
    });
  }

  findMetricName(session, row, column) {
    var metricName = "";

    var tokens;
    var nameLabelNameToken = this.findToken(
      session,
      row,
      column,
      "entity.name.tag",
      "__name__",
      "paren.lparen"
    );
    if (nameLabelNameToken) {
      tokens = session.getTokens(nameLabelNameToken.row);
      var nameLabelValueToken = tokens[nameLabelNameToken.index + 2];
      if (nameLabelValueToken && nameLabelValueToken.type === "string.quoted") {
        metricName = nameLabelValueToken.value.slice(1, -1); // cut begin/end quotation
      }
    } else {
      var metricNameToken = this.findToken(
        session,
        row,
        column,
        "identifier",
        null,
        null
      );
      if (metricNameToken) {
        tokens = session.getTokens(metricNameToken.row);
        if (tokens[metricNameToken.index + 1].type === "paren.lparen") {
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
      if (r === row) {
        // current row
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

        if (
          tokens[idx].type === target &&
          (!value || tokens[idx].value === value)
        ) {
          tokens[idx].row = r;
          tokens[idx].index = idx;
          return tokens[idx];
        }
      }
    }

    return null;
  }
}
