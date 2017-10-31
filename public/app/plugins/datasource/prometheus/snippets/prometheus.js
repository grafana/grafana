// jshint ignore: start
// jscs: disable
ace.define("ace/snippets/prometheus",["require","exports","module"], function(require, exports, module) {
"use strict";

// exports.snippetText = "# rate\n\
// snippet r\n\
//   rate(${1:metric}[${2:range}])\n\
// ";

exports.snippets = [
  {
    "content": "rate(${1:metric}[${2:range}])",
    "name": "rate()",
    "scope": "prometheus",
    "tabTrigger": "r"
  }
];

exports.scope = "prometheus";
});
