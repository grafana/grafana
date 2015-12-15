/* */ 
'use strict';
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
var exceptions_1 = require('../../facade/exceptions');
var collection_1 = require('../../facade/collection');
var api_1 = require('../../core/render/api');
var api_2 = require('./api');
var di_1 = require('../../core/di');
var render_proto_view_ref_store_1 = require('./render_proto_view_ref_store');
var render_view_with_fragments_store_1 = require('./render_view_with_fragments_store');
var view_1 = require('../../core/metadata/view');
exports.PRIMITIVE = String;
var Serializer = (function() {
  function Serializer(_protoViewStore, _renderViewStore) {
    this._protoViewStore = _protoViewStore;
    this._renderViewStore = _renderViewStore;
  }
  Serializer.prototype.serialize = function(obj, type) {
    var _this = this;
    if (!lang_1.isPresent(obj)) {
      return null;
    }
    if (lang_1.isArray(obj)) {
      return obj.map(function(v) {
        return _this.serialize(v, type);
      });
    }
    if (type == exports.PRIMITIVE) {
      return obj;
    }
    if (type == api_1.RenderProtoViewRef) {
      return this._protoViewStore.serialize(obj);
    } else if (type == api_1.RenderViewRef) {
      return this._renderViewStore.serializeRenderViewRef(obj);
    } else if (type == api_1.RenderFragmentRef) {
      return this._renderViewStore.serializeRenderFragmentRef(obj);
    } else if (type == api_2.WebWorkerElementRef) {
      return this._serializeWorkerElementRef(obj);
    } else if (type == api_2.WebWorkerTemplateCmd) {
      return serializeTemplateCmd(obj);
    } else if (type === api_1.RenderComponentTemplate) {
      return this._serializeRenderTemplate(obj);
    } else if (type === view_1.ViewEncapsulation) {
      return lang_1.serializeEnum(obj);
    } else {
      throw new exceptions_1.BaseException("No serializer for " + type.toString());
    }
  };
  Serializer.prototype.deserialize = function(map, type, data) {
    var _this = this;
    if (!lang_1.isPresent(map)) {
      return null;
    }
    if (lang_1.isArray(map)) {
      var obj = [];
      map.forEach(function(val) {
        return obj.push(_this.deserialize(val, type, data));
      });
      return obj;
    }
    if (type == exports.PRIMITIVE) {
      return map;
    }
    if (type == api_1.RenderProtoViewRef) {
      return this._protoViewStore.deserialize(map);
    } else if (type == api_1.RenderViewRef) {
      return this._renderViewStore.deserializeRenderViewRef(map);
    } else if (type == api_1.RenderFragmentRef) {
      return this._renderViewStore.deserializeRenderFragmentRef(map);
    } else if (type == api_2.WebWorkerElementRef) {
      return this._deserializeWorkerElementRef(map);
    } else if (type == api_2.WebWorkerTemplateCmd) {
      return deserializeTemplateCmd(map);
    } else if (type === api_1.RenderComponentTemplate) {
      return this._deserializeRenderTemplate(map);
    } else if (type === view_1.ViewEncapsulation) {
      return view_1.VIEW_ENCAPSULATION_VALUES[map];
    } else {
      throw new exceptions_1.BaseException("No deserializer for " + type.toString());
    }
  };
  Serializer.prototype.mapToObject = function(map, type) {
    var _this = this;
    var object = {};
    var serialize = lang_1.isPresent(type);
    map.forEach(function(value, key) {
      if (serialize) {
        object[key] = _this.serialize(value, type);
      } else {
        object[key] = value;
      }
    });
    return object;
  };
  Serializer.prototype.objectToMap = function(obj, type, data) {
    var _this = this;
    if (lang_1.isPresent(type)) {
      var map = new collection_1.Map();
      collection_1.StringMapWrapper.forEach(obj, function(val, key) {
        map.set(key, _this.deserialize(val, type, data));
      });
      return map;
    } else {
      return collection_1.MapWrapper.createFromStringMap(obj);
    }
  };
  Serializer.prototype.allocateRenderViews = function(fragmentCount) {
    this._renderViewStore.allocate(fragmentCount);
  };
  Serializer.prototype._serializeWorkerElementRef = function(elementRef) {
    return {
      'renderView': this.serialize(elementRef.renderView, api_1.RenderViewRef),
      'boundElementIndex': elementRef.boundElementIndex
    };
  };
  Serializer.prototype._deserializeWorkerElementRef = function(map) {
    return new api_2.WebWorkerElementRef(this.deserialize(map['renderView'], api_1.RenderViewRef), map['boundElementIndex']);
  };
  Serializer.prototype._serializeRenderTemplate = function(obj) {
    return {
      'id': obj.id,
      'shortId': obj.shortId,
      'encapsulation': this.serialize(obj.encapsulation, view_1.ViewEncapsulation),
      'commands': this.serialize(obj.commands, api_2.WebWorkerTemplateCmd),
      'styles': this.serialize(obj.styles, exports.PRIMITIVE)
    };
  };
  Serializer.prototype._deserializeRenderTemplate = function(map) {
    return new api_1.RenderComponentTemplate(map['id'], map['shortId'], this.deserialize(map['encapsulation'], view_1.ViewEncapsulation), this.deserialize(map['commands'], api_2.WebWorkerTemplateCmd), this.deserialize(map['styles'], exports.PRIMITIVE));
  };
  Serializer = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [render_proto_view_ref_store_1.RenderProtoViewRefStore, render_view_with_fragments_store_1.RenderViewWithFragmentsStore])], Serializer);
  return Serializer;
})();
exports.Serializer = Serializer;
function serializeTemplateCmd(cmd) {
  return cmd.visit(RENDER_TEMPLATE_CMD_SERIALIZER, null);
}
function deserializeTemplateCmd(data) {
  return RENDER_TEMPLATE_CMD_DESERIALIZERS[data['deserializerIndex']](data);
}
var RenderTemplateCmdSerializer = (function() {
  function RenderTemplateCmdSerializer() {}
  RenderTemplateCmdSerializer.prototype.visitText = function(cmd, context) {
    return {
      'deserializerIndex': 0,
      'isBound': cmd.isBound,
      'ngContentIndex': cmd.ngContentIndex,
      'value': cmd.value
    };
  };
  RenderTemplateCmdSerializer.prototype.visitNgContent = function(cmd, context) {
    return {
      'deserializerIndex': 1,
      'index': cmd.index,
      'ngContentIndex': cmd.ngContentIndex
    };
  };
  RenderTemplateCmdSerializer.prototype.visitBeginElement = function(cmd, context) {
    return {
      'deserializerIndex': 2,
      'isBound': cmd.isBound,
      'ngContentIndex': cmd.ngContentIndex,
      'name': cmd.name,
      'attrNameAndValues': cmd.attrNameAndValues,
      'eventTargetAndNames': cmd.eventTargetAndNames
    };
  };
  RenderTemplateCmdSerializer.prototype.visitEndElement = function(context) {
    return {'deserializerIndex': 3};
  };
  RenderTemplateCmdSerializer.prototype.visitBeginComponent = function(cmd, context) {
    return {
      'deserializerIndex': 4,
      'isBound': cmd.isBound,
      'ngContentIndex': cmd.ngContentIndex,
      'name': cmd.name,
      'attrNameAndValues': cmd.attrNameAndValues,
      'eventTargetAndNames': cmd.eventTargetAndNames,
      'templateId': cmd.templateId
    };
  };
  RenderTemplateCmdSerializer.prototype.visitEndComponent = function(context) {
    return {'deserializerIndex': 5};
  };
  RenderTemplateCmdSerializer.prototype.visitEmbeddedTemplate = function(cmd, context) {
    var _this = this;
    var children = cmd.children.map(function(child) {
      return child.visit(_this, null);
    });
    return {
      'deserializerIndex': 6,
      'isBound': cmd.isBound,
      'ngContentIndex': cmd.ngContentIndex,
      'name': cmd.name,
      'attrNameAndValues': cmd.attrNameAndValues,
      'eventTargetAndNames': cmd.eventTargetAndNames,
      'isMerged': cmd.isMerged,
      'children': children
    };
  };
  return RenderTemplateCmdSerializer;
})();
var RENDER_TEMPLATE_CMD_SERIALIZER = new RenderTemplateCmdSerializer();
var RENDER_TEMPLATE_CMD_DESERIALIZERS = [function(data) {
  return new api_2.WebWorkerTextCmd(data['isBound'], data['ngContentIndex'], data['value']);
}, function(data) {
  return new api_2.WebWorkerNgContentCmd(data['index'], data['ngContentIndex']);
}, function(data) {
  return new api_2.WebWorkerBeginElementCmd(data['isBound'], data['ngContentIndex'], data['name'], data['attrNameAndValues'], data['eventTargetAndNames']);
}, function(data) {
  return new api_2.WebWorkerEndElementCmd();
}, function(data) {
  return new api_2.WebWorkerBeginComponentCmd(data['isBound'], data['ngContentIndex'], data['name'], data['attrNameAndValues'], data['eventTargetAndNames'], data['templateId']);
}, function(data) {
  return new api_2.WebWorkerEndComponentCmd();
}, function(data) {
  return new api_2.WebWorkerEmbeddedTemplateCmd(data['isBound'], data['ngContentIndex'], data['name'], data['attrNameAndValues'], data['eventTargetAndNames'], data['isMerged'], data['children'].map(function(childData) {
    return deserializeTemplateCmd(childData);
  }));
}];
