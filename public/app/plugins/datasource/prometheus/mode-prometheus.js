// jshint ignore: start
// jscs: disable
ace.define("ace/mode/prometheus_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var PrometheusHighlightRules = function() {
  var keywords = (
    "count|count_values|min|max|avg|sum|stddev|stdvar|bottomk|topk|quantile"
  );

  var builtinConstants = (
    "true|false|null|__name__|job"
  );

  var builtinFunctions = (
    "abs|absent|ceil|changes|clamp_max|clamp_min|count_scalar|day_of_month|day_of_week|days_in_month|delta|deriv|" + "drop_common_labels|exp|floor|histogram_quantile|holt_winters|hour|idelta|increase|irate|label_replace|ln|log2|" +
    "log10|minute|month|predict_linear|rate|resets|round|scalar|sort|sort_desc|sqrt|time|vector|year|avg_over_time|" +
    "min_over_time|max_over_time|sum_over_time|count_over_time|quantile_over_time|stddev_over_time|stdvar_over_time"
  );

  var keywordMapper = this.createKeywordMapper({
    "support.function": builtinFunctions,
    "keyword": keywords,
    "constant.language": builtinConstants
  }, "identifier", true);

  this.$rules = {
    "start" : [ {
      token : "string", // single line
      regex : /"(?:[^"\\]|\\.)*?"/
    }, {
      token : "string", // string
      regex : "'.*?'"
    }, {
      token : "constant.numeric", // float
      regex : "[-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
    }, {
      token : "constant.language", // time
      regex : "\\d+[smhdwy]"
    }, {
      token : "keyword.operator.binary",
      regex : "\\+|\\-|\\*|\\/|%|\\^|==|!=|<=|>=|<|>|and|or|unless"
    }, {
      token : "keyword.other",
      regex : "keep_common|offset|bool"
    }, {
      token : "keyword.control",
      regex : "by|without|on|ignoring|group_left|group_right",
      next  : "start-label-list-matcher"
    }, {
      token : keywordMapper,
      regex : "[a-zA-Z_:][a-zA-Z0-9_:]*"
    }, {
      token : "paren.lparen",
      regex : "[[(]"
    }, {
      token : "paren.lparen.label-matcher",
      regex : "{",
      next  : "start-label-matcher"
    }, {
      token : "paren.rparen",
      regex : "[\\])]"
    }, {
      token : "paren.rparen.label-matcher",
      regex : "}"
    }, {
      token : "text",
      regex : "\\s+"
    } ],
    "start-label-matcher" : [ {
      token : "entity.name.tag.label-matcher",
      regex : '[a-zA-Z_][a-zA-Z0-9_]*'
    }, {
      token : "keyword.operator.label-matcher",
      regex : '=~|=|!~|!='
    }, {
      token : "string.quoted.label-matcher",
      regex : '"[^"]*"|\'[^\']*\''
    }, {
      token : "punctuation.operator.label-matcher",
      regex : ","
    }, {
      token : "paren.rparen.label-matcher",
      regex : "}",
      next  : "start"
    } ],
    "start-label-list-matcher" : [ {
      token : "paren.lparen.label-list-matcher",
      regex : "[(]"
    }, {
      token : "entity.name.tag.label-list-matcher",
      regex : '[a-zA-Z_][a-zA-Z0-9_]*'
    }, {
      token : "punctuation.operator.label-list-matcher",
      regex : ","
    }, {
      token : "paren.rparen.label-list-matcher",
      regex : "[)]",
      next  : "start"
    } ]
  };

  this.normalizeRules();
};

oop.inherits(PrometheusHighlightRules, TextHighlightRules);

exports.PrometheusHighlightRules = PrometheusHighlightRules;
});

ace.define("ace/mode/prometheus_completions",["require","exports","module","ace/token_iterator", "ace/lib/lang"], function(require, exports, module) {
"use strict";

var lang = require("../lib/lang");

var prometheusKeyWords = [
  "by", "without", "keep_common", "offset", "bool", "and", "or", "unless", "ignoring", "on", "group_left",
  "group_right", "count", "count_values", "min", "max", "avg", "sum", "stddev", "stdvar", "bottomk", "topk", "quantile"
];

var keyWordsCompletions = prometheusKeyWords.map(function(word) {
  return {
    caption: word,
    value: word,
    meta: "keyword",
    score: Number.MAX_VALUE
  }
});

var prometheusFunctions = [
  {
    name: 'abs()', value: 'abs',
    def: 'abs(v instant-vector)',
    docText: 'Returns the input vector with all sample values converted to their absolute value.'
  },
  {
    name: 'absent()', value: 'absent',
    def: 'absent(v instant-vector)',
    docText: 'Returns an empty vector if the vector passed to it has any elements and a 1-element vector with the value 1 if the vector passed to it has no elements. This is useful for alerting on when no time series exist for a given metric name and label combination.'
  },
  {
    name: 'ceil()', value: 'ceil',
    def: 'ceil(v instant-vector)',
    docText: 'Rounds the sample values of all elements in `v` up to the nearest integer.'
  },
  {
    name: 'changes()', value: 'changes',
    def: 'changes(v range-vector)',
    docText: 'For each input time series, `changes(v range-vector)` returns the number of times its value has changed within the provided time range as an instant vector.'
  },
  {
    name: 'clamp_max()', value: 'clamp_max',
    def: 'clamp_max(v instant-vector, max scalar)',
    docText: 'Clamps the sample values of all elements in `v` to have an upper limit of `max`.'
  },
  {
    name: 'clamp_min()', value: 'clamp_min',
    def: 'clamp_min(v instant-vector, min scalar)',
    docText: 'Clamps the sample values of all elements in `v` to have a lower limit of `min`.'
  },
  {
    name: 'count_scalar()', value: 'count_scalar',
    def: 'count_scalar(v instant-vector)',
    docText: 'Returns the number of elements in a time series vector as a scalar. This is in contrast to the `count()` aggregation operator, which always returns a vector (an empty one if the input vector is empty) and allows grouping by labels via a `by` clause.'
  },
  {
    name: 'day_of_month()', value: 'day_of_month',
    def: 'day_of_month(v=vector(time()) instant-vector)',
    docText: 'Returns the day of the month for each of the given times in UTC. Returned values are from 1 to 31.'
  },
  {
    name: 'day_of_week()', value: 'day_of_week',
    def: 'day_of_week(v=vector(time()) instant-vector)',
    docText: 'Returns the day of the week for each of the given times in UTC. Returned values are from 0 to 6, where 0 means Sunday etc.'
  },
  {
    name: 'days_in_month()', value: 'days_in_month',
    def: 'days_in_month(v=vector(time()) instant-vector)',
    docText: 'Returns number of days in the month for each of the given times in UTC. Returned values are from 28 to 31.'
  },
  {
    name: 'delta()', value: 'delta',
    def: 'delta(v range-vector)',
    docText: 'Calculates the difference between the first and last value of each time series element in a range vector `v`, returning an instant vector with the given deltas and equivalent labels. The delta is extrapolated to cover the full time range as specified in the range vector selector, so that it is possible to get a non-integer result even if the sample values are all integers.'
  },
  {
    name: 'deriv()', value: 'deriv',
    def: 'deriv(v range-vector)',
    docText: 'Calculates the per-second derivative of the time series in a range vector `v`, using simple linear regression.'
  },
  {
    name: 'drop_common_labels()', value: 'drop_common_labels',
    def: 'drop_common_labels(instant-vector)',
    docText: 'Drops all labels that have the same name and value across all series in the input vector.'
  },
  {
    name: 'exp()', value: 'exp',
    def: 'exp(v instant-vector)',
    docText: 'Calculates the exponential function for all elements in `v`.\nSpecial cases are:\n* `Exp(+Inf) = +Inf` \n* `Exp(NaN) = NaN`'
  },
  {
    name: 'floor()', value: 'floor',
    def: 'floor(v instant-vector)',
    docText: 'Rounds the sample values of all elements in `v` down to the nearest integer.'
  },
  {
    name: 'histogram_quantile()', value: 'histogram_quantile',
    def: 'histogram_quantile(φ float, b instant-vector)',
    docText: 'Calculates the φ-quantile (0 ≤ φ ≤ 1) from the buckets `b` of a histogram. The samples in `b` are the counts of observations in each bucket. Each sample must have a label `le` where the label value denotes the inclusive upper bound of the bucket. (Samples without such a label are silently ignored.) The histogram metric type automatically provides time series with the `_bucket` suffix and the appropriate labels.'
  },
  {
    name: 'holt_winters()', value: 'holt_winters',
    def: 'holt_winters(v range-vector, sf scalar, tf scalar)',
    docText: 'Produces a smoothed value for time series based on the range in `v`. The lower the smoothing factor `sf`, the more importance is given to old data. The higher the trend factor `tf`, the more trends in the data is considered. Both `sf` and `tf` must be between 0 and 1.'
  },
  {
    name: 'hour()', value: 'hour',
    def: 'hour(v=vector(time()) instant-vector)',
    docText: 'Returns the hour of the day for each of the given times in UTC. Returned values are from 0 to 23.'
  },
  {
    name: 'idelta()', value: 'idelta',
    def: 'idelta(v range-vector)',
    docText: 'Calculates the difference between the last two samples in the range vector `v`, returning an instant vector with the given deltas and equivalent labels.'
  },
  {
    name: 'increase()', value: 'increase',
    def: 'increase(v range-vector)',
    docText: 'Calculates the increase in the time series in the range vector. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for. The increase is extrapolated to cover the full time range as specified in the range vector selector, so that it is possible to get a non-integer result even if a counter increases only by integer increments.'
  },
  {
    name: 'irate()', value: 'irate',
    def: 'irate(v range-vector)',
    docText: 'Calculates the per-second instant rate of increase of the time series in the range vector. This is based on the last two data points. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for.'
  },
  {
    name: 'label_replace()', value: 'label_replace',
    def: 'label_replace(v instant-vector, dst_label string, replacement string, src_label string, regex string)',
    docText: 'For each timeseries in `v`, `label_replace(v instant-vector, dst_label string, replacement string, src_label string, regex string)`  matches the regular expression `regex` against the label `src_label`.  If it matches, then the timeseries is returned with the label `dst_label` replaced by the expansion of `replacement`. `$1` is replaced with the first matching subgroup, `$2` with the second etc. If the regular expression doesn\'t match then the timeseries is returned unchanged.'
  },
  {
    name: 'ln()', value: 'ln',
    def: 'ln(v instant-vector)',
    docText: 'calculates the natural logarithm for all elements in `v`.\nSpecial cases are:\n * `ln(+Inf) = +Inf`\n * `ln(0) = -Inf`\n * `ln(x < 0) = NaN`\n * `ln(NaN) = NaN`'
  },
  {
    name: 'log2()', value: 'log2',
    def: 'log2(v instant-vector)',
    docText: 'Calculates the binary logarithm for all elements in `v`. The special cases are equivalent to those in `ln`.'
  },
  {
    name: 'log10()', value: 'log10',
    def: 'log10(v instant-vector)',
    docText: 'Calculates the decimal logarithm for all elements in `v`. The special cases are equivalent to those in `ln`.'
  },
  {
    name: 'minute()', value: 'minute',
    def: 'minute(v=vector(time()) instant-vector)',
    docText: 'Returns the minute of the hour for each of the given times in UTC. Returned values are from 0 to 59.'
  },
  {
    name: 'month()', value: 'month',
    def: 'month(v=vector(time()) instant-vector)',
    docText: 'Returns the month of the year for each of the given times in UTC. Returned values are from 1 to 12, where 1 means January etc.'
  },
  {
    name: 'predict_linear()', value: 'predict_linear',
    def: 'predict_linear(v range-vector, t scalar)',
    docText: 'Predicts the value of time series `t` seconds from now, based on the range vector `v`, using simple linear regression.'
  },
  {
    name: 'rate()', value: 'rate',
    def: 'rate(v range-vector)',
    docText: "Calculates the per-second average rate of increase of the time series in the range vector. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for. Also, the calculation extrapolates to the ends of the time range, allowing for missed scrapes or imperfect alignment of scrape cycles with the range's time period."
  },
  {
    name: 'resets()', value: 'resets',
    def: 'resets(v range-vector)',
    docText: 'For each input time series, `resets(v range-vector)` returns the number of counter resets within the provided time range as an instant vector. Any decrease in the value between two consecutive samples is interpreted as a counter reset.'
  },
  {
    name: 'round()', value: 'round',
    def: 'round(v instant-vector, to_nearest=1 scalar)',
    docText: 'Rounds the sample values of all elements in `v` to the nearest integer. Ties are resolved by rounding up. The optional `to_nearest` argument allows specifying the nearest multiple to which the sample values should be rounded. This multiple may also be a fraction.'
  },
  {
    name: 'scalar()', value: 'scalar',
    def: 'scalar(v instant-vector)',
    docText: 'Given a single-element input vector, `scalar(v instant-vector)` returns the sample value of that single element as a scalar. If the input vector does not have exactly one element, `scalar` will return `NaN`.'
  },
  {
    name: 'sort()', value: 'sort',
    def: 'sort(v instant-vector)',
    docText: 'Returns vector elements sorted by their sample values, in ascending order.'
  },
  {
    name: 'sort_desc()', value: 'sort_desc',
    def: 'sort_desc(v instant-vector)',
    docText: 'Returns vector elements sorted by their sample values, in descending order.'
  },
  {
    name: 'sqrt()', value: 'sqrt',
    def: 'sqrt(v instant-vector)',
    docText: 'Calculates the square root of all elements in `v`.'
  },
  {
    name: 'time()', value: 'time',
    def: 'time()',
    docText: 'Returns the number of seconds since January 1, 1970 UTC. Note that this does not actually return the current time, but the time at which the expression is to be evaluated.'
  },
  {
    name: 'vector()', value: 'vector',
    def: 'vector(s scalar)',
    docText: 'Returns the scalar `s` as a vector with no labels.'
  },
  {
    name: 'year()', value: 'year',
    def: 'year(v=vector(time()) instant-vector)',
    docText: 'Returns the year for each of the given times in UTC.'
  },
  {
    name: 'avg_over_time()', value: 'avg_over_time',
    def: 'avg_over_time(range-vector)',
    docText: 'The average value of all points in the specified interval.'
  },
  {
    name: 'min_over_time()', value: 'min_over_time',
    def: 'min_over_time(range-vector)',
    docText: 'The minimum value of all points in the specified interval.'
  },
  {
    name: 'max_over_time()', value: 'max_over_time',
    def: 'max_over_time(range-vector)',
    docText: 'The maximum value of all points in the specified interval.'
  },
  {
    name: 'sum_over_time()', value: 'sum_over_time',
    def: 'sum_over_time(range-vector)',
    docText: 'The sum of all values in the specified interval.'
  },
  {
    name: 'count_over_time()', value: 'count_over_time',
    def: 'count_over_time(range-vector)',
    docText: 'The count of all values in the specified interval.'
  },
  {
    name: 'quantile_over_time()', value: 'quantile_over_time',
    def: 'quantile_over_time(scalar, range-vector)',
    docText: 'The φ-quantile (0 ≤ φ ≤ 1) of the values in the specified interval.'
  },
  {
    name: 'stddev_over_time()', value: 'stddev_over_time',
    def: 'stddev_over_time(range-vector)',
    docText: 'The population standard deviation of the values in the specified interval.'
  },
  {
    name: 'stdvar_over_time()', value: 'stdvar_over_time',
    def: 'stdvar_over_time(range-vector)',
    docText: 'The population standard variance of the values in the specified interval.'
  },
];

function wrapText(str, len) {
  len = len || 60;
  var lines = [];
  var space_index = 0;
  var line_start = 0;
  var next_line_end = len;
  var line = "";
  for (var i = 0; i < str.length; i++) {
    if (str[i] === ' ') {
      space_index = i;
    } else if (i >= next_line_end  && space_index != 0) {
      line = str.slice(line_start, space_index);
      lines.push(line);
      line_start = space_index + 1;
      next_line_end = i + len;
      space_index = 0;
    }
  }
  line = str.slice(line_start);
  lines.push(line);
  return lines.join("&nbsp<br>");
}

function convertMarkDownTags(text) {
  text = text.replace(/```(.+)```/, "<pre>$1</pre>");
  text = text.replace(/`([^`]+)`/, "<code>$1</code>");
  return text;
}

function convertToHTML(item) {
  var docText = lang.escapeHTML(item.docText);
  docText = convertMarkDownTags(wrapText(docText, 40));
  return [
    "<b>", lang.escapeHTML(item.def), "</b>", "<hr></hr>", docText, "<br>&nbsp"
  ].join("");
}

var functionsCompletions = prometheusFunctions.map(function(item) {
  return {
    caption: item.name,
    value: item.value,
    docHTML: convertToHTML(item),
    meta: "function",
    score: Number.MAX_VALUE
  };
});

var PrometheusCompletions = function() {};

(function() {
  this.getCompletions = function(state, session, pos, prefix, callback) {
    var token = session.getTokenAt(pos.row, pos.column);
    if (token.type === 'entity.name.tag.label-matcher'
      || token.type === 'string.quoted.label-matcher'
      || token.type === 'entity.name.tag.label-list-matcher') {
      return callback(null, []);
    }

    var completions = keyWordsCompletions.concat(functionsCompletions);
    callback(null, completions);
  };

}).call(PrometheusCompletions.prototype);

exports.PrometheusCompletions = PrometheusCompletions;
});

ace.define("ace/mode/behaviour/prometheus",["require","exports","module","ace/lib/oop","ace/mode/behaviour","ace/mode/behaviour/cstyle","ace/token_iterator"], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var Behaviour = require("../behaviour").Behaviour;
var CstyleBehaviour = require("./cstyle").CstyleBehaviour;
var TokenIterator = require("../../token_iterator").TokenIterator;

function getWrapped(selection, selected, opening, closing) {
  var rowDiff = selection.end.row - selection.start.row;
  return {
    text: opening + selected + closing,
    selection: [
      0,
      selection.start.column + 1,
      rowDiff,
      selection.end.column + (rowDiff ? 0 : 1)
    ]
  };
};

var PrometheusBehaviour = function () {
  this.inherit(CstyleBehaviour);

  // Rewrite default CstyleBehaviour for {} braces
  this.add("braces", "insertion", function(state, action, editor, session, text) {
    if (text == '{') {
      var selection = editor.getSelectionRange();
      var selected = session.doc.getTextRange(selection);
      if (selected !== "" && editor.getWrapBehavioursEnabled()) {
        return getWrapped(selection, selected, '{', '}');
      } else if (CstyleBehaviour.isSaneInsertion(editor, session)) {
        return {
          text: '{}',
          selection: [1, 1]
        };
      }
    } else if (text == '}') {
      var cursor = editor.getCursorPosition();
      var line = session.doc.getLine(cursor.row);
      var rightChar = line.substring(cursor.column, cursor.column + 1);
      if (rightChar == '}') {
        var matching = session.$findOpeningBracket('}', {column: cursor.column + 1, row: cursor.row});
        if (matching !== null && CstyleBehaviour.isAutoInsertedClosing(cursor, line, text)) {
          return {
            text: '',
            selection: [1, 1]
          };
        }
      }
    }
  });

  this.add("braces", "deletion", function(state, action, editor, session, range) {
    var selected = session.doc.getTextRange(range);
    if (!range.isMultiLine() && selected == '{') {
      var line = session.doc.getLine(range.start.row);
      var rightChar = line.substring(range.start.column + 1, range.start.column + 2);
      if (rightChar == '}') {
        range.end.column++;
        return range;
      }
    }
  });

}
oop.inherits(PrometheusBehaviour, CstyleBehaviour);

exports.PrometheusBehaviour = PrometheusBehaviour;
});

ace.define("ace/mode/prometheus",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/prometheus_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var PrometheusHighlightRules = require("./prometheus_highlight_rules").PrometheusHighlightRules;
var PrometheusCompletions = require("./prometheus_completions").PrometheusCompletions;
var PrometheusBehaviour = require("./behaviour/prometheus").PrometheusBehaviour;

var Mode = function() {
  this.HighlightRules = PrometheusHighlightRules;
  this.$behaviour = new PrometheusBehaviour();
  this.$completer = new PrometheusCompletions();
  // replace keyWordCompleter
  this.completer = this.$completer;
};
oop.inherits(Mode, TextMode);

(function() {

  this.$id = "ace/mode/prometheus";
}).call(Mode.prototype);

exports.Mode = Mode;

});
