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
var lang_1 = require('../../facade/lang');
var di_1 = require('../di');
var metadata_1 = require('../di/metadata');
var AttributeMetadata = (function(_super) {
  __extends(AttributeMetadata, _super);
  function AttributeMetadata(attributeName) {
    _super.call(this);
    this.attributeName = attributeName;
  }
  Object.defineProperty(AttributeMetadata.prototype, "token", {
    get: function() {
      return this;
    },
    enumerable: true,
    configurable: true
  });
  AttributeMetadata.prototype.toString = function() {
    return "@Attribute(" + lang_1.stringify(this.attributeName) + ")";
  };
  AttributeMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [String])], AttributeMetadata);
  return AttributeMetadata;
})(metadata_1.DependencyMetadata);
exports.AttributeMetadata = AttributeMetadata;
var QueryMetadata = (function(_super) {
  __extends(QueryMetadata, _super);
  function QueryMetadata(_selector, _a) {
    var _b = _a === void 0 ? {} : _a,
        _c = _b.descendants,
        descendants = _c === void 0 ? false : _c,
        _d = _b.first,
        first = _d === void 0 ? false : _d;
    _super.call(this);
    this._selector = _selector;
    this.descendants = descendants;
    this.first = first;
  }
  Object.defineProperty(QueryMetadata.prototype, "isViewQuery", {
    get: function() {
      return false;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(QueryMetadata.prototype, "selector", {
    get: function() {
      return di_1.resolveForwardRef(this._selector);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(QueryMetadata.prototype, "isVarBindingQuery", {
    get: function() {
      return lang_1.isString(this.selector);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(QueryMetadata.prototype, "varBindings", {
    get: function() {
      return this.selector.split(',');
    },
    enumerable: true,
    configurable: true
  });
  QueryMetadata.prototype.toString = function() {
    return "@Query(" + lang_1.stringify(this.selector) + ")";
  };
  QueryMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object, Object])], QueryMetadata);
  return QueryMetadata;
})(metadata_1.DependencyMetadata);
exports.QueryMetadata = QueryMetadata;
var ContentChildrenMetadata = (function(_super) {
  __extends(ContentChildrenMetadata, _super);
  function ContentChildrenMetadata(_selector, _a) {
    var _b = (_a === void 0 ? {} : _a).descendants,
        descendants = _b === void 0 ? false : _b;
    _super.call(this, _selector, {descendants: descendants});
  }
  ContentChildrenMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object, Object])], ContentChildrenMetadata);
  return ContentChildrenMetadata;
})(QueryMetadata);
exports.ContentChildrenMetadata = ContentChildrenMetadata;
var ContentChildMetadata = (function(_super) {
  __extends(ContentChildMetadata, _super);
  function ContentChildMetadata(_selector) {
    _super.call(this, _selector, {
      descendants: true,
      first: true
    });
  }
  ContentChildMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object])], ContentChildMetadata);
  return ContentChildMetadata;
})(QueryMetadata);
exports.ContentChildMetadata = ContentChildMetadata;
var ViewQueryMetadata = (function(_super) {
  __extends(ViewQueryMetadata, _super);
  function ViewQueryMetadata(_selector, _a) {
    var _b = _a === void 0 ? {} : _a,
        _c = _b.descendants,
        descendants = _c === void 0 ? false : _c,
        _d = _b.first,
        first = _d === void 0 ? false : _d;
    _super.call(this, _selector, {
      descendants: descendants,
      first: first
    });
  }
  Object.defineProperty(ViewQueryMetadata.prototype, "isViewQuery", {
    get: function() {
      return true;
    },
    enumerable: true,
    configurable: true
  });
  ViewQueryMetadata.prototype.toString = function() {
    return "@ViewQuery(" + lang_1.stringify(this.selector) + ")";
  };
  ViewQueryMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object, Object])], ViewQueryMetadata);
  return ViewQueryMetadata;
})(QueryMetadata);
exports.ViewQueryMetadata = ViewQueryMetadata;
var ViewChildrenMetadata = (function(_super) {
  __extends(ViewChildrenMetadata, _super);
  function ViewChildrenMetadata(_selector) {
    _super.call(this, _selector, {descendants: true});
  }
  ViewChildrenMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object])], ViewChildrenMetadata);
  return ViewChildrenMetadata;
})(ViewQueryMetadata);
exports.ViewChildrenMetadata = ViewChildrenMetadata;
var ViewChildMetadata = (function(_super) {
  __extends(ViewChildMetadata, _super);
  function ViewChildMetadata(_selector) {
    _super.call(this, _selector, {
      descendants: true,
      first: true
    });
  }
  ViewChildMetadata = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [Object])], ViewChildMetadata);
  return ViewChildMetadata;
})(ViewQueryMetadata);
exports.ViewChildMetadata = ViewChildMetadata;
