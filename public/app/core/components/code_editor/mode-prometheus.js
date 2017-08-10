// jshint ignore: start
// jscs: disable
ace.define("ace/mode/prometheus_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var PrometheusHighlightRules = function() {
  var keywords = (
    "by|without|keep_common|offset|bool|and|or|unless|ignoring|on|group_left|group_right|" +
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
      token : keywordMapper,
      regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
    }, {
      token : "keyword.operator",
      regex : "\\+|\\-|\\*|\\/|%|\\^|=|==|!=|<=|>=|<|>|=\\~|!\\~"
    }, {
      token : "paren.lparen",
      regex : "[[({]"
    }, {
      token : "paren.rparen",
      regex : "[\\])}]"
    }, {
      token : "text",
      regex : "\\s+"
    } ]
  };
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
    name: 'abs()', value: 'abs',
    def: 'abs(v instant-vector)',
    docText: 'returns the input vector with all sample values converted to their absolute value.'
  },
  {
    name: 'absent()', value: 'absent',
    def: 'absent(v instant-vector)',
    docText: 'returns an empty vector if the vector passed to it has any elements and a 1-element vector with the value 1 if the vector passed to it has no elements. This is useful for alerting on when no time series exist for a given metric name and label combination.'
  },
  {
    name: 'ceil()', value: 'ceil',
    def: 'ceil(v instant-vector)',
    docText: 'rounds the sample values of all elements in `v` up to the nearest integer.'
  },
  {
    name: 'changes()', value: 'changes',
    def: 'changes()',
    docText: ''
  },
  {
    name: 'clamp_max()', value: 'clamp_max',
    def: 'clamp_max()',
    docText: ''
  },
  {
    name: 'clamp_min()', value: 'clamp_min',
    def: 'clamp_min()',
    docText: ''
  },
  {
    name: 'count_scalar()', value: 'count_scalar',
    def: 'count_scalar()',
    docText: ''
  },
  {
    name: 'day_of_month()', value: 'day_of_month',
    def: 'day_of_month()',
    docText: ''
  },
  {
    name: 'day_of_week()', value: 'day_of_week',
    def: 'day_of_week()',
    docText: ''
  },
  {
    name: 'days_in_month()', value: 'days_in_month',
    def: 'days_in_month()',
    docText: ''
  },
  {
    name: 'delta()', value: 'delta',
    def: 'delta()',
    docText: ''
  },
  {
    name: 'deriv()', value: 'deriv',
    def: 'deriv()',
    docText: ''
  },
  {
    name: 'drop_common_labels()', value: 'drop_common_labels',
    def: 'drop_common_labels()',
    docText: ''
  },
  {
    name: 'exp()', value: 'exp',
    def: 'exp()',
    docText: ''
  },
  {
    name: 'floor()', value: 'floor',
    def: 'floor()',
    docText: ''
  },
  {
    name: 'histogram_quantile()', value: 'histogram_quantile',
    def: 'histogram_quantile()',
    docText: ''
  },
  {
    name: 'holt_winters()', value: 'holt_winters',
    def: 'holt_winters()',
    docText: ''
  },
  {
    name: 'hour()', value: 'hour',
    def: 'hour()',
    docText: ''
  },
  {
    name: 'idelta()', value: 'idelta',
    def: 'idelta()',
    docText: ''
  },
  {
    name: 'increase()', value: 'increase',
    def: 'increase()',
    docText: ''
  },
  {
    name: 'irate()', value: 'irate',
    def: 'irate()',
    docText: ''
  },
  {
    name: 'label_replace()', value: 'label_replace',
    def: 'label_replace()',
    docText: ''
  },
  {
    name: 'ln()', value: 'ln',
    def: 'ln()',
    docText: ''
  },
  {
    name: 'log2()', value: 'log2',
    def: 'log2()',
    docText: ''
  },
  {
    name: 'log10()', value: 'log10',
    def: 'log10()',
    docText: ''
  },
  {
    name: 'minute()', value: 'minute',
    def: 'minute()',
    docText: ''
  },
  {
    name: 'month()', value: 'month',
    def: 'month()',
    docText: ''
  },
  {
    name: 'predict_linear()', value: 'predict_linear',
    def: 'predict_linear()',
    docText: ''
  },
  {
    name: 'rate()', value: 'rate',
    def: 'rate()',
    docText: ''
  },
  {
    name: 'resets()', value: 'resets',
    def: 'resets()',
    docText: ''
  },
  {
    name: 'round()', value: 'round',
    def: 'round()',
    docText: ''
  },
  {
    name: 'scalar()', value: 'scalar',
    def: 'scalar()',
    docText: ''
  },
  {
    name: 'sort()', value: 'sort',
    def: 'sort()',
    docText: ''
  },
  {
    name: 'sort_desc()', value: 'sort_desc',
    def: 'sort_desc()',
    docText: ''
  },
  {
    name: 'sqrt()', value: 'sqrt',
    def: 'sqrt()',
    docText: ''
  },
  {
    name: 'time()', value: 'time',
    def: 'time()',
    docText: ''
  },
  {
    name: 'vector()', value: 'vector',
    def: 'vector()',
    docText: ''
  },
  {
    name: 'year()', value: 'year',
    def: 'year()',
    docText: ''
  },
  {
    name: 'avg_over_time()', value: 'avg_over_time',
    def: 'avg_over_time()',
    docText: ''
  },
  {
    name: 'min_over_time()', value: 'min_over_time',
    def: 'min_over_time()',
    docText: ''
  },
  {
    name: 'max_over_time()', value: 'max_over_time',
    def: 'max_over_time()',
    docText: ''
  },
  {
    name: 'sum_over_time()', value: 'sum_over_time',
    def: 'sum_over_time()',
    docText: ''
  },
  {
    name: 'count_over_time()', value: 'count_over_time',
    def: 'count_over_time()',
    docText: ''
  },
  {
    name: 'quantile_over_time()', value: 'quantile_over_time',
    def: 'quantile_over_time()',
    docText: ''
  },
  {
    name: 'stddev_over_time()', value: 'stddev_over_time',
    def: 'stddev_over_time()',
    docText: ''
  },
  {
    name: 'stdvar_over_time()', value: 'stdvar_over_time',
    def: 'stdvar_over_time()',
    docText: ''
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
  docText = convertMarkDownTags(wrapText(docText));
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
