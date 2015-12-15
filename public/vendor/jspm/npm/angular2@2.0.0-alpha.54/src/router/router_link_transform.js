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
var compiler_1 = require('../../compiler');
var ast_1 = require('../core/change_detection/parser/ast');
var exceptions_1 = require('../facade/exceptions');
var core_1 = require('../../core');
var parser_1 = require('../core/change_detection/parser/parser');
var FixedPart = (function() {
  function FixedPart(value) {
    this.value = value;
  }
  return FixedPart;
})();
var AuxiliaryStart = (function() {
  function AuxiliaryStart() {}
  return AuxiliaryStart;
})();
var AuxiliaryEnd = (function() {
  function AuxiliaryEnd() {}
  return AuxiliaryEnd;
})();
var Params = (function() {
  function Params(ast) {
    this.ast = ast;
  }
  return Params;
})();
var RouterLinkLexer = (function() {
  function RouterLinkLexer(parser, exp) {
    this.parser = parser;
    this.exp = exp;
    this.index = 0;
  }
  RouterLinkLexer.prototype.tokenize = function() {
    var tokens = [];
    while (this.index < this.exp.length) {
      tokens.push(this._parseToken());
    }
    return tokens;
  };
  RouterLinkLexer.prototype._parseToken = function() {
    var c = this.exp[this.index];
    if (c == '[') {
      this.index++;
      return new AuxiliaryStart();
    } else if (c == ']') {
      this.index++;
      return new AuxiliaryEnd();
    } else if (c == '(') {
      return this._parseParams();
    } else if (c == '/' && this.index !== 0) {
      this.index++;
      return this._parseFixedPart();
    } else {
      return this._parseFixedPart();
    }
  };
  RouterLinkLexer.prototype._parseParams = function() {
    var start = this.index;
    for (; this.index < this.exp.length; ++this.index) {
      var c = this.exp[this.index];
      if (c == ')') {
        var paramsContent = this.exp.substring(start + 1, this.index);
        this.index++;
        return new Params(this.parser.parseBinding("{" + paramsContent + "}", null).ast);
      }
    }
    throw new exceptions_1.BaseException("Cannot find ')'");
  };
  RouterLinkLexer.prototype._parseFixedPart = function() {
    var start = this.index;
    var sawNonSlash = false;
    for (; this.index < this.exp.length; ++this.index) {
      var c = this.exp[this.index];
      if (c == '(' || c == '[' || c == ']' || (c == '/' && sawNonSlash)) {
        break;
      }
      if (c != '.' && c != '/') {
        sawNonSlash = true;
      }
    }
    var fixed = this.exp.substring(start, this.index);
    if (start === this.index || !sawNonSlash || fixed.startsWith('//')) {
      throw new exceptions_1.BaseException("Invalid router link");
    }
    return new FixedPart(fixed);
  };
  return RouterLinkLexer;
})();
var RouterLinkAstGenerator = (function() {
  function RouterLinkAstGenerator(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }
  RouterLinkAstGenerator.prototype.generate = function() {
    return this._genAuxiliary();
  };
  RouterLinkAstGenerator.prototype._genAuxiliary = function() {
    var arr = [];
    for (; this.index < this.tokens.length; this.index++) {
      var r = this.tokens[this.index];
      if (r instanceof FixedPart) {
        arr.push(new ast_1.LiteralPrimitive(r.value));
      } else if (r instanceof Params) {
        arr.push(r.ast);
      } else if (r instanceof AuxiliaryEnd) {
        break;
      } else if (r instanceof AuxiliaryStart) {
        this.index++;
        arr.push(this._genAuxiliary());
      }
    }
    return new ast_1.LiteralArray(arr);
  };
  return RouterLinkAstGenerator;
})();
var RouterLinkAstTransformer = (function(_super) {
  __extends(RouterLinkAstTransformer, _super);
  function RouterLinkAstTransformer(parser) {
    _super.call(this);
    this.parser = parser;
  }
  RouterLinkAstTransformer.prototype.visitQuote = function(ast) {
    if (ast.prefix == "route") {
      return parseRouterLinkExpression(this.parser, ast.uninterpretedExpression);
    } else {
      return _super.prototype.visitQuote.call(this, ast);
    }
  };
  return RouterLinkAstTransformer;
})(ast_1.AstTransformer);
function parseRouterLinkExpression(parser, exp) {
  var tokens = new RouterLinkLexer(parser, exp.trim()).tokenize();
  return new RouterLinkAstGenerator(tokens).generate();
}
exports.parseRouterLinkExpression = parseRouterLinkExpression;
var RouterLinkTransform = (function() {
  function RouterLinkTransform(parser) {
    this.astTransformer = new RouterLinkAstTransformer(parser);
  }
  RouterLinkTransform.prototype.visitNgContent = function(ast, context) {
    return ast;
  };
  RouterLinkTransform.prototype.visitEmbeddedTemplate = function(ast, context) {
    return ast;
  };
  RouterLinkTransform.prototype.visitElement = function(ast, context) {
    var _this = this;
    var updatedChildren = ast.children.map(function(c) {
      return c.visit(_this, context);
    });
    var updatedInputs = ast.inputs.map(function(c) {
      return c.visit(_this, context);
    });
    var updatedDirectives = ast.directives.map(function(c) {
      return c.visit(_this, context);
    });
    return new compiler_1.ElementAst(ast.name, ast.attrs, updatedInputs, ast.outputs, ast.exportAsVars, updatedDirectives, updatedChildren, ast.ngContentIndex, ast.sourceSpan);
  };
  RouterLinkTransform.prototype.visitVariable = function(ast, context) {
    return ast;
  };
  RouterLinkTransform.prototype.visitEvent = function(ast, context) {
    return ast;
  };
  RouterLinkTransform.prototype.visitElementProperty = function(ast, context) {
    return ast;
  };
  RouterLinkTransform.prototype.visitAttr = function(ast, context) {
    return ast;
  };
  RouterLinkTransform.prototype.visitBoundText = function(ast, context) {
    return ast;
  };
  RouterLinkTransform.prototype.visitText = function(ast, context) {
    return ast;
  };
  RouterLinkTransform.prototype.visitDirective = function(ast, context) {
    var _this = this;
    var updatedInputs = ast.inputs.map(function(c) {
      return c.visit(_this, context);
    });
    return new compiler_1.DirectiveAst(ast.directive, updatedInputs, ast.hostProperties, ast.hostEvents, ast.exportAsVars, ast.sourceSpan);
  };
  RouterLinkTransform.prototype.visitDirectiveProperty = function(ast, context) {
    var transformedValue = ast.value.visit(this.astTransformer);
    return new compiler_1.BoundDirectivePropertyAst(ast.directiveName, ast.templateName, transformedValue, ast.sourceSpan);
  };
  RouterLinkTransform = __decorate([core_1.Injectable(), __metadata('design:paramtypes', [parser_1.Parser])], RouterLinkTransform);
  return RouterLinkTransform;
})();
exports.RouterLinkTransform = RouterLinkTransform;
