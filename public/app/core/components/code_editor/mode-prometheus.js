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
      regex : "[\\(]"
    }, {
      token : "paren.rparen",
      regex : "[\\)]"
    }, {
      token : "text",
      regex : "\\s+"
    } ]
  };
};

oop.inherits(PrometheusHighlightRules, TextHighlightRules);

exports.PrometheusHighlightRules = PrometheusHighlightRules;
});

ace.define("ace/mode/prometheus",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/prometheus_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var PrometheusHighlightRules = require("./prometheus_highlight_rules").PrometheusHighlightRules;

var Mode = function() {
  this.HighlightRules = PrometheusHighlightRules;
  this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {

  this.$id = "ace/mode/prometheus";
}).call(Mode.prototype);

exports.Mode = Mode;

});
