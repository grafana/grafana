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
var di_1 = require('../../core/di');
var lang_1 = require('../../facade/lang');
var collection_1 = require('../../facade/collection');
var dom_adapter_1 = require('../../platform/dom/dom_adapter');
var html_tags_1 = require('../html_tags');
var element_schema_registry_1 = require('./element_schema_registry');
var NAMESPACE_URIS = lang_1.CONST_EXPR({
  'xlink': 'http://www.w3.org/1999/xlink',
  'svg': 'http://www.w3.org/2000/svg'
});
var DomElementSchemaRegistry = (function(_super) {
  __extends(DomElementSchemaRegistry, _super);
  function DomElementSchemaRegistry() {
    _super.apply(this, arguments);
    this._protoElements = new Map();
  }
  DomElementSchemaRegistry.prototype._getProtoElement = function(tagName) {
    var element = this._protoElements.get(tagName);
    if (lang_1.isBlank(element)) {
      var nsAndName = html_tags_1.splitNsName(tagName);
      element = lang_1.isPresent(nsAndName[0]) ? dom_adapter_1.DOM.createElementNS(NAMESPACE_URIS[nsAndName[0]], nsAndName[1]) : dom_adapter_1.DOM.createElement(nsAndName[1]);
      this._protoElements.set(tagName, element);
    }
    return element;
  };
  DomElementSchemaRegistry.prototype.hasProperty = function(tagName, propName) {
    if (tagName.indexOf('-') !== -1) {
      return true;
    } else {
      var elm = this._getProtoElement(tagName);
      return dom_adapter_1.DOM.hasProperty(elm, propName);
    }
  };
  DomElementSchemaRegistry.prototype.getMappedPropName = function(propName) {
    var mappedPropName = collection_1.StringMapWrapper.get(dom_adapter_1.DOM.attrToPropMap, propName);
    return lang_1.isPresent(mappedPropName) ? mappedPropName : propName;
  };
  DomElementSchemaRegistry = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], DomElementSchemaRegistry);
  return DomElementSchemaRegistry;
})(element_schema_registry_1.ElementSchemaRegistry);
exports.DomElementSchemaRegistry = DomElementSchemaRegistry;
