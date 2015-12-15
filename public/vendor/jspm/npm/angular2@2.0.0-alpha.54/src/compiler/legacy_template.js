/* */ 
'use strict';
var __extends = (this && this.__extends) || function(d, b) {
  for (var p in b)
    if (b.hasOwnProperty(p))
      d[p] = b[p];
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
};
var di_1 = require('../core/di');
var lang_1 = require('../facade/lang');
var html_ast_1 = require('./html_ast');
var html_parser_1 = require('./html_parser');
var util_1 = require('./util');
var LONG_SYNTAX_REGEXP = /^(?:on-(.*)|bindon-(.*)|bind-(.*)|var-(.*))$/ig;
var SHORT_SYNTAX_REGEXP = /^(?:\((.*)\)|\[\((.*)\)\]|\[(.*)\]|#(.*))$/ig;
var VARIABLE_TPL_BINDING_REGEXP = /(\bvar\s+|#)(\S+)/ig;
var TEMPLATE_SELECTOR_REGEXP = /^(\S+)/g;
var SPECIAL_PREFIXES_REGEXP = /^(class|style|attr)\./ig;
var INTERPOLATION_REGEXP = /\{\{.*?\}\}/g;
var SPECIAL_CASES = lang_1.CONST_EXPR(['ng-non-bindable', 'ng-default-control', 'ng-no-form']);
var LegacyHtmlAstTransformer = (function() {
  function LegacyHtmlAstTransformer(dashCaseSelectors) {
    this.dashCaseSelectors = dashCaseSelectors;
    this.rewrittenAst = [];
    this.visitingTemplateEl = false;
  }
  LegacyHtmlAstTransformer.prototype.visitElement = function(ast, context) {
    var _this = this;
    this.visitingTemplateEl = ast.name.toLowerCase() == 'template';
    var attrs = ast.attrs.map(function(attr) {
      return attr.visit(_this, null);
    });
    var children = ast.children.map(function(child) {
      return child.visit(_this, null);
    });
    return new html_ast_1.HtmlElementAst(ast.name, attrs, children, ast.sourceSpan);
  };
  LegacyHtmlAstTransformer.prototype.visitAttr = function(originalAst, context) {
    var ast = originalAst;
    if (this.visitingTemplateEl) {
      if (lang_1.isPresent(lang_1.RegExpWrapper.firstMatch(LONG_SYNTAX_REGEXP, ast.name))) {
        ast = this._rewriteLongSyntax(ast);
      } else {
        var name_1 = util_1.dashCaseToCamelCase(ast.name);
        ast = name_1 == ast.name ? ast : new html_ast_1.HtmlAttrAst(name_1, ast.value, ast.sourceSpan);
      }
    } else {
      ast = this._rewriteTemplateAttribute(ast);
      ast = this._rewriteLongSyntax(ast);
      ast = this._rewriteShortSyntax(ast);
      ast = this._rewriteStar(ast);
      ast = this._rewriteInterpolation(ast);
      ast = this._rewriteSpecialCases(ast);
    }
    if (ast !== originalAst) {
      this.rewrittenAst.push(ast);
    }
    return ast;
  };
  LegacyHtmlAstTransformer.prototype.visitText = function(ast, context) {
    return ast;
  };
  LegacyHtmlAstTransformer.prototype._rewriteLongSyntax = function(ast) {
    var m = lang_1.RegExpWrapper.firstMatch(LONG_SYNTAX_REGEXP, ast.name);
    var attrName = ast.name;
    var attrValue = ast.value;
    if (lang_1.isPresent(m)) {
      if (lang_1.isPresent(m[1])) {
        attrName = "on-" + util_1.dashCaseToCamelCase(m[1]);
      } else if (lang_1.isPresent(m[2])) {
        attrName = "bindon-" + util_1.dashCaseToCamelCase(m[2]);
      } else if (lang_1.isPresent(m[3])) {
        attrName = "bind-" + util_1.dashCaseToCamelCase(m[3]);
      } else if (lang_1.isPresent(m[4])) {
        attrName = "var-" + util_1.dashCaseToCamelCase(m[4]);
        attrValue = util_1.dashCaseToCamelCase(attrValue);
      }
    }
    return attrName == ast.name && attrValue == ast.value ? ast : new html_ast_1.HtmlAttrAst(attrName, attrValue, ast.sourceSpan);
  };
  LegacyHtmlAstTransformer.prototype._rewriteTemplateAttribute = function(ast) {
    var name = ast.name;
    var value = ast.value;
    if (name.toLowerCase() == 'template') {
      name = 'template';
      value = lang_1.StringWrapper.replaceAllMapped(value, TEMPLATE_SELECTOR_REGEXP, function(m) {
        return util_1.dashCaseToCamelCase(m[1]);
      });
      value = lang_1.StringWrapper.replaceAllMapped(value, VARIABLE_TPL_BINDING_REGEXP, function(m) {
        return "" + m[1].toLowerCase() + util_1.dashCaseToCamelCase(m[2]);
      });
    }
    if (name == ast.name && value == ast.value) {
      return ast;
    }
    return new html_ast_1.HtmlAttrAst(name, value, ast.sourceSpan);
  };
  LegacyHtmlAstTransformer.prototype._rewriteShortSyntax = function(ast) {
    var m = lang_1.RegExpWrapper.firstMatch(SHORT_SYNTAX_REGEXP, ast.name);
    var attrName = ast.name;
    var attrValue = ast.value;
    if (lang_1.isPresent(m)) {
      if (lang_1.isPresent(m[1])) {
        attrName = "(" + util_1.dashCaseToCamelCase(m[1]) + ")";
      } else if (lang_1.isPresent(m[2])) {
        attrName = "[(" + util_1.dashCaseToCamelCase(m[2]) + ")]";
      } else if (lang_1.isPresent(m[3])) {
        var prop = lang_1.StringWrapper.replaceAllMapped(m[3], SPECIAL_PREFIXES_REGEXP, function(m) {
          return m[1].toLowerCase() + '.';
        });
        if (prop.startsWith('class.') || prop.startsWith('attr.') || prop.startsWith('style.')) {
          attrName = "[" + prop + "]";
        } else {
          attrName = "[" + util_1.dashCaseToCamelCase(prop) + "]";
        }
      } else if (lang_1.isPresent(m[4])) {
        attrName = "#" + util_1.dashCaseToCamelCase(m[4]);
        attrValue = util_1.dashCaseToCamelCase(attrValue);
      }
    }
    return attrName == ast.name && attrValue == ast.value ? ast : new html_ast_1.HtmlAttrAst(attrName, attrValue, ast.sourceSpan);
  };
  LegacyHtmlAstTransformer.prototype._rewriteStar = function(ast) {
    var attrName = ast.name;
    var attrValue = ast.value;
    if (attrName[0] == '*') {
      attrName = util_1.dashCaseToCamelCase(attrName);
      attrValue = lang_1.StringWrapper.replaceAllMapped(attrValue, VARIABLE_TPL_BINDING_REGEXP, function(m) {
        return "" + m[1].toLowerCase() + util_1.dashCaseToCamelCase(m[2]);
      });
    }
    return attrName == ast.name && attrValue == ast.value ? ast : new html_ast_1.HtmlAttrAst(attrName, attrValue, ast.sourceSpan);
  };
  LegacyHtmlAstTransformer.prototype._rewriteInterpolation = function(ast) {
    var hasInterpolation = lang_1.RegExpWrapper.test(INTERPOLATION_REGEXP, ast.value);
    if (!hasInterpolation) {
      return ast;
    }
    var name = ast.name;
    if (!(name.startsWith('attr.') || name.startsWith('class.') || name.startsWith('style.'))) {
      name = util_1.dashCaseToCamelCase(ast.name);
    }
    return name == ast.name ? ast : new html_ast_1.HtmlAttrAst(name, ast.value, ast.sourceSpan);
  };
  LegacyHtmlAstTransformer.prototype._rewriteSpecialCases = function(ast) {
    var attrName = ast.name;
    if (SPECIAL_CASES.indexOf(attrName) > -1) {
      return new html_ast_1.HtmlAttrAst(util_1.dashCaseToCamelCase(attrName), ast.value, ast.sourceSpan);
    }
    if (lang_1.isPresent(this.dashCaseSelectors) && this.dashCaseSelectors.indexOf(attrName) > -1) {
      return new html_ast_1.HtmlAttrAst(util_1.dashCaseToCamelCase(attrName), ast.value, ast.sourceSpan);
    }
    return ast;
  };
  return LegacyHtmlAstTransformer;
})();
exports.LegacyHtmlAstTransformer = LegacyHtmlAstTransformer;
var LegacyHtmlParser = (function(_super) {
  __extends(LegacyHtmlParser, _super);
  function LegacyHtmlParser() {
    _super.apply(this, arguments);
  }
  LegacyHtmlParser.prototype.parse = function(sourceContent, sourceUrl) {
    var transformer = new LegacyHtmlAstTransformer();
    var htmlParseTreeResult = _super.prototype.parse.call(this, sourceContent, sourceUrl);
    var rootNodes = htmlParseTreeResult.rootNodes.map(function(node) {
      return node.visit(transformer, null);
    });
    return transformer.rewrittenAst.length > 0 ? new html_parser_1.HtmlParseTreeResult(rootNodes, htmlParseTreeResult.errors) : htmlParseTreeResult;
  };
  LegacyHtmlParser = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], LegacyHtmlParser);
  return LegacyHtmlParser;
})(html_parser_1.HtmlParser);
exports.LegacyHtmlParser = LegacyHtmlParser;
