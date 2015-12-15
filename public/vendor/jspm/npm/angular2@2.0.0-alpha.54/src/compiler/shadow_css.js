/* */ 
(function(process) {
  'use strict';
  var collection_1 = require('../facade/collection');
  var lang_1 = require('../facade/lang');
  var ShadowCss = (function() {
    function ShadowCss() {
      this.strictStyling = true;
    }
    ShadowCss.prototype.shimCssText = function(cssText, selector, hostSelector) {
      if (hostSelector === void 0) {
        hostSelector = '';
      }
      cssText = stripComments(cssText);
      cssText = this._insertDirectives(cssText);
      return this._scopeCssText(cssText, selector, hostSelector);
    };
    ShadowCss.prototype._insertDirectives = function(cssText) {
      cssText = this._insertPolyfillDirectivesInCssText(cssText);
      return this._insertPolyfillRulesInCssText(cssText);
    };
    ShadowCss.prototype._insertPolyfillDirectivesInCssText = function(cssText) {
      return lang_1.StringWrapper.replaceAllMapped(cssText, _cssContentNextSelectorRe, function(m) {
        return m[1] + '{';
      });
    };
    ShadowCss.prototype._insertPolyfillRulesInCssText = function(cssText) {
      return lang_1.StringWrapper.replaceAllMapped(cssText, _cssContentRuleRe, function(m) {
        var rule = m[0];
        rule = lang_1.StringWrapper.replace(rule, m[1], '');
        rule = lang_1.StringWrapper.replace(rule, m[2], '');
        return m[3] + rule;
      });
    };
    ShadowCss.prototype._scopeCssText = function(cssText, scopeSelector, hostSelector) {
      var unscoped = this._extractUnscopedRulesFromCssText(cssText);
      cssText = this._insertPolyfillHostInCssText(cssText);
      cssText = this._convertColonHost(cssText);
      cssText = this._convertColonHostContext(cssText);
      cssText = this._convertShadowDOMSelectors(cssText);
      if (lang_1.isPresent(scopeSelector)) {
        cssText = this._scopeSelectors(cssText, scopeSelector, hostSelector);
      }
      cssText = cssText + '\n' + unscoped;
      return cssText.trim();
    };
    ShadowCss.prototype._extractUnscopedRulesFromCssText = function(cssText) {
      var r = '',
          m;
      var matcher = lang_1.RegExpWrapper.matcher(_cssContentUnscopedRuleRe, cssText);
      while (lang_1.isPresent(m = lang_1.RegExpMatcherWrapper.next(matcher))) {
        var rule = m[0];
        rule = lang_1.StringWrapper.replace(rule, m[2], '');
        rule = lang_1.StringWrapper.replace(rule, m[1], m[3]);
        r += rule + '\n\n';
      }
      return r;
    };
    ShadowCss.prototype._convertColonHost = function(cssText) {
      return this._convertColonRule(cssText, _cssColonHostRe, this._colonHostPartReplacer);
    };
    ShadowCss.prototype._convertColonHostContext = function(cssText) {
      return this._convertColonRule(cssText, _cssColonHostContextRe, this._colonHostContextPartReplacer);
    };
    ShadowCss.prototype._convertColonRule = function(cssText, regExp, partReplacer) {
      return lang_1.StringWrapper.replaceAllMapped(cssText, regExp, function(m) {
        if (lang_1.isPresent(m[2])) {
          var parts = m[2].split(','),
              r = [];
          for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (lang_1.isBlank(p))
              break;
            p = p.trim();
            r.push(partReplacer(_polyfillHostNoCombinator, p, m[3]));
          }
          return r.join(',');
        } else {
          return _polyfillHostNoCombinator + m[3];
        }
      });
    };
    ShadowCss.prototype._colonHostContextPartReplacer = function(host, part, suffix) {
      if (lang_1.StringWrapper.contains(part, _polyfillHost)) {
        return this._colonHostPartReplacer(host, part, suffix);
      } else {
        return host + part + suffix + ', ' + part + ' ' + host + suffix;
      }
    };
    ShadowCss.prototype._colonHostPartReplacer = function(host, part, suffix) {
      return host + lang_1.StringWrapper.replace(part, _polyfillHost, '') + suffix;
    };
    ShadowCss.prototype._convertShadowDOMSelectors = function(cssText) {
      for (var i = 0; i < _shadowDOMSelectorsRe.length; i++) {
        cssText = lang_1.StringWrapper.replaceAll(cssText, _shadowDOMSelectorsRe[i], ' ');
      }
      return cssText;
    };
    ShadowCss.prototype._scopeSelectors = function(cssText, scopeSelector, hostSelector) {
      var _this = this;
      return processRules(cssText, function(rule) {
        var selector = rule.selector;
        var content = rule.content;
        if (rule.selector[0] != '@' || rule.selector.startsWith('@page')) {
          selector = _this._scopeSelector(rule.selector, scopeSelector, hostSelector, _this.strictStyling);
        } else if (rule.selector.startsWith('@media')) {
          content = _this._scopeSelectors(rule.content, scopeSelector, hostSelector);
        }
        return new CssRule(selector, content);
      });
    };
    ShadowCss.prototype._scopeSelector = function(selector, scopeSelector, hostSelector, strict) {
      var r = [],
          parts = selector.split(',');
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p = p.trim();
        if (this._selectorNeedsScoping(p, scopeSelector)) {
          p = strict && !lang_1.StringWrapper.contains(p, _polyfillHostNoCombinator) ? this._applyStrictSelectorScope(p, scopeSelector) : this._applySelectorScope(p, scopeSelector, hostSelector);
        }
        r.push(p);
      }
      return r.join(', ');
    };
    ShadowCss.prototype._selectorNeedsScoping = function(selector, scopeSelector) {
      var re = this._makeScopeMatcher(scopeSelector);
      return !lang_1.isPresent(lang_1.RegExpWrapper.firstMatch(re, selector));
    };
    ShadowCss.prototype._makeScopeMatcher = function(scopeSelector) {
      var lre = /\[/g;
      var rre = /\]/g;
      scopeSelector = lang_1.StringWrapper.replaceAll(scopeSelector, lre, '\\[');
      scopeSelector = lang_1.StringWrapper.replaceAll(scopeSelector, rre, '\\]');
      return lang_1.RegExpWrapper.create('^(' + scopeSelector + ')' + _selectorReSuffix, 'm');
    };
    ShadowCss.prototype._applySelectorScope = function(selector, scopeSelector, hostSelector) {
      return this._applySimpleSelectorScope(selector, scopeSelector, hostSelector);
    };
    ShadowCss.prototype._applySimpleSelectorScope = function(selector, scopeSelector, hostSelector) {
      if (lang_1.isPresent(lang_1.RegExpWrapper.firstMatch(_polyfillHostRe, selector))) {
        var replaceBy = this.strictStyling ? "[" + hostSelector + "]" : scopeSelector;
        selector = lang_1.StringWrapper.replace(selector, _polyfillHostNoCombinator, replaceBy);
        return lang_1.StringWrapper.replaceAll(selector, _polyfillHostRe, replaceBy + ' ');
      } else {
        return scopeSelector + ' ' + selector;
      }
    };
    ShadowCss.prototype._applyStrictSelectorScope = function(selector, scopeSelector) {
      var isRe = /\[is=([^\]]*)\]/g;
      scopeSelector = lang_1.StringWrapper.replaceAllMapped(scopeSelector, isRe, function(m) {
        return m[1];
      });
      var splits = [' ', '>', '+', '~'],
          scoped = selector,
          attrName = '[' + scopeSelector + ']';
      for (var i = 0; i < splits.length; i++) {
        var sep = splits[i];
        var parts = scoped.split(sep);
        scoped = parts.map(function(p) {
          var t = lang_1.StringWrapper.replaceAll(p.trim(), _polyfillHostRe, '');
          if (t.length > 0 && !collection_1.ListWrapper.contains(splits, t) && !lang_1.StringWrapper.contains(t, attrName)) {
            var re = /([^:]*)(:*)(.*)/g;
            var m = lang_1.RegExpWrapper.firstMatch(re, t);
            if (lang_1.isPresent(m)) {
              p = m[1] + attrName + m[2] + m[3];
            }
          }
          return p;
        }).join(sep);
      }
      return scoped;
    };
    ShadowCss.prototype._insertPolyfillHostInCssText = function(selector) {
      selector = lang_1.StringWrapper.replaceAll(selector, _colonHostContextRe, _polyfillHostContext);
      selector = lang_1.StringWrapper.replaceAll(selector, _colonHostRe, _polyfillHost);
      return selector;
    };
    return ShadowCss;
  })();
  exports.ShadowCss = ShadowCss;
  var _cssContentNextSelectorRe = /polyfill-next-selector[^}]*content:[\s]*?['"](.*?)['"][;\s]*}([^{]*?){/gim;
  var _cssContentRuleRe = /(polyfill-rule)[^}]*(content:[\s]*['"](.*?)['"])[;\s]*[^}]*}/gim;
  var _cssContentUnscopedRuleRe = /(polyfill-unscoped-rule)[^}]*(content:[\s]*['"](.*?)['"])[;\s]*[^}]*}/gim;
  var _polyfillHost = '-shadowcsshost';
  var _polyfillHostContext = '-shadowcsscontext';
  var _parenSuffix = ')(?:\\((' + '(?:\\([^)(]*\\)|[^)(]*)+?' + ')\\))?([^,{]*)';
  var _cssColonHostRe = lang_1.RegExpWrapper.create('(' + _polyfillHost + _parenSuffix, 'im');
  var _cssColonHostContextRe = lang_1.RegExpWrapper.create('(' + _polyfillHostContext + _parenSuffix, 'im');
  var _polyfillHostNoCombinator = _polyfillHost + '-no-combinator';
  var _shadowDOMSelectorsRe = [/>>>/g, /::shadow/g, /::content/g, /\/deep\//g, /\/shadow-deep\//g, /\/shadow\//g];
  var _selectorReSuffix = '([>\\s~+\[.,{:][\\s\\S]*)?$';
  var _polyfillHostRe = lang_1.RegExpWrapper.create(_polyfillHost, 'im');
  var _colonHostRe = /:host/gim;
  var _colonHostContextRe = /:host-context/gim;
  var _commentRe = /\/\*[\s\S]*?\*\//g;
  function stripComments(input) {
    return lang_1.StringWrapper.replaceAllMapped(input, _commentRe, function(_) {
      return '';
    });
  }
  var _ruleRe = /(\s*)([^;\{\}]+?)(\s*)((?:{%BLOCK%}?\s*;?)|(?:\s*;))/g;
  var _curlyRe = /([{}])/g;
  var OPEN_CURLY = '{';
  var CLOSE_CURLY = '}';
  var BLOCK_PLACEHOLDER = '%BLOCK%';
  var CssRule = (function() {
    function CssRule(selector, content) {
      this.selector = selector;
      this.content = content;
    }
    return CssRule;
  })();
  exports.CssRule = CssRule;
  function processRules(input, ruleCallback) {
    var inputWithEscapedBlocks = escapeBlocks(input);
    var nextBlockIndex = 0;
    return lang_1.StringWrapper.replaceAllMapped(inputWithEscapedBlocks.escapedString, _ruleRe, function(m) {
      var selector = m[2];
      var content = '';
      var suffix = m[4];
      var contentPrefix = '';
      if (lang_1.isPresent(m[4]) && m[4].startsWith('{' + BLOCK_PLACEHOLDER)) {
        content = inputWithEscapedBlocks.blocks[nextBlockIndex++];
        suffix = m[4].substring(BLOCK_PLACEHOLDER.length + 1);
        contentPrefix = '{';
      }
      var rule = ruleCallback(new CssRule(selector, content));
      return "" + m[1] + rule.selector + m[3] + contentPrefix + rule.content + suffix;
    });
  }
  exports.processRules = processRules;
  var StringWithEscapedBlocks = (function() {
    function StringWithEscapedBlocks(escapedString, blocks) {
      this.escapedString = escapedString;
      this.blocks = blocks;
    }
    return StringWithEscapedBlocks;
  })();
  function escapeBlocks(input) {
    var inputParts = lang_1.StringWrapper.split(input, _curlyRe);
    var resultParts = [];
    var escapedBlocks = [];
    var bracketCount = 0;
    var currentBlockParts = [];
    for (var partIndex = 0; partIndex < inputParts.length; partIndex++) {
      var part = inputParts[partIndex];
      if (part == CLOSE_CURLY) {
        bracketCount--;
      }
      if (bracketCount > 0) {
        currentBlockParts.push(part);
      } else {
        if (currentBlockParts.length > 0) {
          escapedBlocks.push(currentBlockParts.join(''));
          resultParts.push(BLOCK_PLACEHOLDER);
          currentBlockParts = [];
        }
        resultParts.push(part);
      }
      if (part == OPEN_CURLY) {
        bracketCount++;
      }
    }
    if (currentBlockParts.length > 0) {
      escapedBlocks.push(currentBlockParts.join(''));
      resultParts.push(BLOCK_PLACEHOLDER);
    }
    return new StringWithEscapedBlocks(resultParts.join(''), escapedBlocks);
  }
})(require('process'));
