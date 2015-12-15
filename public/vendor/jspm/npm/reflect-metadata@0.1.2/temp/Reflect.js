/* */ 
"use strict";
var Reflect;
(function(Reflect) {
  var functionPrototype = Object.getPrototypeOf(Function);
  var _Map = typeof Map === "function" ? Map : CreateMapPolyfill();
  var _Set = typeof Set === "function" ? Set : CreateSetPolyfill();
  var _WeakMap = typeof WeakMap === "function" ? WeakMap : CreateWeakMapPolyfill();
  var __Metadata__ = new _WeakMap();
  function decorate(decorators, target, targetKey, targetDescriptor) {
    if (!IsUndefined(targetDescriptor)) {
      if (!IsArray(decorators)) {
        throw new TypeError();
      } else if (!IsObject(target)) {
        throw new TypeError();
      } else if (IsUndefined(targetKey)) {
        throw new TypeError();
      } else if (!IsObject(targetDescriptor)) {
        throw new TypeError();
      }
      targetKey = ToPropertyKey(targetKey);
      return DecoratePropertyWithDescriptor(decorators, target, targetKey, targetDescriptor);
    } else if (!IsUndefined(targetKey)) {
      if (!IsArray(decorators)) {
        throw new TypeError();
      } else if (!IsObject(target)) {
        throw new TypeError();
      }
      targetKey = ToPropertyKey(targetKey);
      return DecoratePropertyWithoutDescriptor(decorators, target, targetKey);
    } else {
      if (!IsArray(decorators)) {
        throw new TypeError();
      } else if (!IsConstructor(target)) {
        throw new TypeError();
      }
      return DecorateConstructor(decorators, target);
    }
  }
  Reflect.decorate = decorate;
  function metadata(metadataKey, metadataValue) {
    function decorator(target, targetKey) {
      if (!IsUndefined(targetKey)) {
        if (!IsObject(target)) {
          throw new TypeError();
        }
        targetKey = ToPropertyKey(targetKey);
        OrdinaryDefineOwnMetadata(metadataKey, metadataValue, target, targetKey);
      } else {
        if (!IsConstructor(target)) {
          throw new TypeError();
        }
        OrdinaryDefineOwnMetadata(metadataKey, metadataValue, target, undefined);
      }
    }
    return decorator;
  }
  Reflect.metadata = metadata;
  function defineMetadata(metadataKey, metadataValue, target, targetKey) {
    if (!IsObject(target)) {
      throw new TypeError();
    } else if (!IsUndefined(targetKey)) {
      targetKey = ToPropertyKey(targetKey);
    }
    return OrdinaryDefineOwnMetadata(metadataKey, metadataValue, target, targetKey);
  }
  Reflect.defineMetadata = defineMetadata;
  function hasMetadata(metadataKey, target, targetKey) {
    if (!IsObject(target)) {
      throw new TypeError();
    } else if (!IsUndefined(targetKey)) {
      targetKey = ToPropertyKey(targetKey);
    }
    return OrdinaryHasMetadata(metadataKey, target, targetKey);
  }
  Reflect.hasMetadata = hasMetadata;
  function hasOwnMetadata(metadataKey, target, targetKey) {
    if (!IsObject(target)) {
      throw new TypeError();
    } else if (!IsUndefined(targetKey)) {
      targetKey = ToPropertyKey(targetKey);
    }
    return OrdinaryHasOwnMetadata(metadataKey, target, targetKey);
  }
  Reflect.hasOwnMetadata = hasOwnMetadata;
  function getMetadata(metadataKey, target, targetKey) {
    if (!IsObject(target)) {
      throw new TypeError();
    } else if (!IsUndefined(targetKey)) {
      targetKey = ToPropertyKey(targetKey);
    }
    return OrdinaryGetMetadata(metadataKey, target, targetKey);
  }
  Reflect.getMetadata = getMetadata;
  function getOwnMetadata(metadataKey, target, targetKey) {
    if (!IsObject(target)) {
      throw new TypeError();
    } else if (!IsUndefined(targetKey)) {
      targetKey = ToPropertyKey(targetKey);
    }
    return OrdinaryGetOwnMetadata(metadataKey, target, targetKey);
  }
  Reflect.getOwnMetadata = getOwnMetadata;
  function getMetadataKeys(target, targetKey) {
    if (!IsObject(target)) {
      throw new TypeError();
    } else if (!IsUndefined(targetKey)) {
      targetKey = ToPropertyKey(targetKey);
    }
    return OrdinaryMetadataKeys(target, targetKey);
  }
  Reflect.getMetadataKeys = getMetadataKeys;
  function getOwnMetadataKeys(target, targetKey) {
    if (!IsObject(target)) {
      throw new TypeError();
    } else if (!IsUndefined(targetKey)) {
      targetKey = ToPropertyKey(targetKey);
    }
    return OrdinaryOwnMetadataKeys(target, targetKey);
  }
  Reflect.getOwnMetadataKeys = getOwnMetadataKeys;
  function deleteMetadata(metadataKey, target, targetKey) {
    if (!IsObject(target)) {
      throw new TypeError();
    } else if (!IsUndefined(targetKey)) {
      targetKey = ToPropertyKey(targetKey);
    }
    var metadataMap = GetOrCreateMetadataMap(target, targetKey, false);
    if (IsUndefined(metadataMap)) {
      return false;
    }
    if (!metadataMap.delete(metadataKey)) {
      return false;
    }
    if (metadataMap.size > 0) {
      return true;
    }
    var targetMetadata = __Metadata__.get(target);
    targetMetadata.delete(targetKey);
    if (targetMetadata.size > 0) {
      return true;
    }
    __Metadata__.delete(target);
    return true;
  }
  Reflect.deleteMetadata = deleteMetadata;
  function DecorateConstructor(decorators, target) {
    for (var i = decorators.length - 1; i >= 0; --i) {
      var decorator = decorators[i];
      var decorated = decorator(target);
      if (!IsUndefined(decorated)) {
        if (!IsConstructor(decorated)) {
          throw new TypeError();
        }
        target = decorated;
      }
    }
    return target;
  }
  function DecoratePropertyWithDescriptor(decorators, target, propertyKey, descriptor) {
    for (var i = decorators.length - 1; i >= 0; --i) {
      var decorator = decorators[i];
      var decorated = decorator(target, propertyKey, descriptor);
      if (!IsUndefined(decorated)) {
        if (!IsObject(decorated)) {
          throw new TypeError();
        }
        descriptor = decorated;
      }
    }
    return descriptor;
  }
  function DecoratePropertyWithoutDescriptor(decorators, target, propertyKey) {
    for (var i = decorators.length - 1; i >= 0; --i) {
      var decorator = decorators[i];
      decorator(target, propertyKey);
    }
  }
  function GetOrCreateMetadataMap(target, targetKey, create) {
    var targetMetadata = __Metadata__.get(target);
    if (!targetMetadata) {
      if (!create) {
        return undefined;
      }
      targetMetadata = new _Map();
      __Metadata__.set(target, targetMetadata);
    }
    var keyMetadata = targetMetadata.get(targetKey);
    if (!keyMetadata) {
      if (!create) {
        return undefined;
      }
      keyMetadata = new _Map();
      targetMetadata.set(targetKey, keyMetadata);
    }
    return keyMetadata;
  }
  function OrdinaryHasMetadata(MetadataKey, O, P) {
    var hasOwn = OrdinaryHasOwnMetadata(MetadataKey, O, P);
    if (hasOwn) {
      return true;
    }
    var parent = GetPrototypeOf(O);
    if (parent !== null) {
      return OrdinaryHasMetadata(MetadataKey, parent, P);
    }
    return false;
  }
  function OrdinaryHasOwnMetadata(MetadataKey, O, P) {
    var metadataMap = GetOrCreateMetadataMap(O, P, false);
    if (metadataMap === undefined) {
      return false;
    }
    return Boolean(metadataMap.has(MetadataKey));
  }
  function OrdinaryGetMetadata(MetadataKey, O, P) {
    var hasOwn = OrdinaryHasOwnMetadata(MetadataKey, O, P);
    if (hasOwn) {
      return OrdinaryGetOwnMetadata(MetadataKey, O, P);
    }
    var parent = GetPrototypeOf(O);
    if (parent !== null) {
      return OrdinaryGetMetadata(MetadataKey, parent, P);
    }
    return undefined;
  }
  function OrdinaryGetOwnMetadata(MetadataKey, O, P) {
    var metadataMap = GetOrCreateMetadataMap(O, P, false);
    if (metadataMap === undefined) {
      return undefined;
    }
    return metadataMap.get(MetadataKey);
  }
  function OrdinaryDefineOwnMetadata(MetadataKey, MetadataValue, O, P) {
    var metadataMap = GetOrCreateMetadataMap(O, P, true);
    metadataMap.set(MetadataKey, MetadataValue);
  }
  function OrdinaryMetadataKeys(O, P) {
    var ownKeys = OrdinaryOwnMetadataKeys(O, P);
    var parent = GetPrototypeOf(O);
    if (parent === null) {
      return ownKeys;
    }
    var parentKeys = OrdinaryMetadataKeys(parent, P);
    if (parentKeys.length <= 0) {
      return ownKeys;
    }
    if (ownKeys.length <= 0) {
      return parentKeys;
    }
    var set = new _Set();
    var keys = [];
    for (var _i = 0; _i < ownKeys.length; _i++) {
      var key = ownKeys[_i];
      var hasKey = set.has(key);
      if (!hasKey) {
        set.add(key);
        keys.push(key);
      }
    }
    for (var _a = 0; _a < parentKeys.length; _a++) {
      var key = parentKeys[_a];
      var hasKey = set.has(key);
      if (!hasKey) {
        set.add(key);
        keys.push(key);
      }
    }
    return keys;
  }
  function OrdinaryOwnMetadataKeys(target, targetKey) {
    var metadataMap = GetOrCreateMetadataMap(target, targetKey, false);
    var keys = [];
    if (metadataMap) {
      metadataMap.forEach(function(_, key) {
        return keys.push(key);
      });
    }
    return keys;
  }
  function IsUndefined(x) {
    return x === undefined;
  }
  function IsArray(x) {
    return Array.isArray(x);
  }
  function IsObject(x) {
    return typeof x === "object" ? x !== null : typeof x === "function";
  }
  function IsConstructor(x) {
    return typeof x === "function";
  }
  function IsSymbol(x) {
    return typeof x === "symbol";
  }
  function ToPropertyKey(value) {
    if (IsSymbol(value)) {
      return value;
    }
    return String(value);
  }
  function GetPrototypeOf(O) {
    var proto = Object.getPrototypeOf(O);
    if (typeof O !== "function" || O === functionPrototype) {
      return proto;
    }
    if (proto !== functionPrototype) {
      return proto;
    }
    var prototype = O.prototype;
    var prototypeProto = Object.getPrototypeOf(prototype);
    if (prototypeProto == null || prototypeProto === Object.prototype) {
      return proto;
    }
    var constructor = prototypeProto.constructor;
    if (typeof constructor !== "function") {
      return proto;
    }
    if (constructor === O) {
      return proto;
    }
    return constructor;
  }
  function CreateMapPolyfill() {
    var cacheSentinel = {};
    function Map() {
      this._keys = [];
      this._values = [];
      this._cache = cacheSentinel;
    }
    Map.prototype = {
      get size() {
        return this._keys.length;
      },
      has: function(key) {
        if (key === this._cache) {
          return true;
        }
        if (this._find(key) >= 0) {
          this._cache = key;
          return true;
        }
        return false;
      },
      get: function(key) {
        var index = this._find(key);
        if (index >= 0) {
          this._cache = key;
          return this._values[index];
        }
        return undefined;
      },
      set: function(key, value) {
        this.delete(key);
        this._keys.push(key);
        this._values.push(value);
        this._cache = key;
        return this;
      },
      delete: function(key) {
        var index = this._find(key);
        if (index >= 0) {
          this._keys.splice(index, 1);
          this._values.splice(index, 1);
          this._cache = cacheSentinel;
          return true;
        }
        return false;
      },
      clear: function() {
        this._keys.length = 0;
        this._values.length = 0;
        this._cache = cacheSentinel;
      },
      forEach: function(callback, thisArg) {
        var size = this.size;
        for (var i = 0; i < size; ++i) {
          var key = this._keys[i];
          var value = this._values[i];
          this._cache = key;
          callback.call(this, value, key, this);
        }
      },
      _find: function(key) {
        var keys = this._keys;
        var size = keys.length;
        for (var i = 0; i < size; ++i) {
          if (keys[i] === key) {
            return i;
          }
        }
        return -1;
      }
    };
    return Map;
  }
  function CreateSetPolyfill() {
    var cacheSentinel = {};
    function Set() {
      this._map = new _Map();
    }
    Set.prototype = {
      get size() {
        return this._map.length;
      },
      has: function(value) {
        return this._map.has(value);
      },
      add: function(value) {
        this._map.set(value, value);
        return this;
      },
      delete: function(value) {
        return this._map.delete(value);
      },
      clear: function() {
        this._map.clear();
      },
      forEach: function(callback, thisArg) {
        this._map.forEach(callback, thisArg);
      }
    };
    return Set;
  }
  function CreateWeakMapPolyfill() {
    var UUID_SIZE = 16;
    var isNode = typeof global !== "undefined" && typeof module === "object" && typeof module.exports === "object" && typeof require === "function";
    var nodeCrypto = isNode && require('@empty');
    var hasOwn = Object.prototype.hasOwnProperty;
    var keys = {};
    var rootKey = CreateUniqueKey();
    function WeakMap() {
      this._key = CreateUniqueKey();
    }
    WeakMap.prototype = {
      has: function(target) {
        var table = GetOrCreateWeakMapTable(target, false);
        if (table) {
          return this._key in table;
        }
        return false;
      },
      get: function(target) {
        var table = GetOrCreateWeakMapTable(target, false);
        if (table) {
          return table[this._key];
        }
        return undefined;
      },
      set: function(target, value) {
        var table = GetOrCreateWeakMapTable(target, true);
        table[this._key] = value;
        return this;
      },
      delete: function(target) {
        var table = GetOrCreateWeakMapTable(target, false);
        if (table && this._key in table) {
          return delete table[this._key];
        }
        return false;
      },
      clear: function() {
        this._key = CreateUniqueKey();
      }
    };
    function FillRandomBytes(buffer, size) {
      for (var i = 0; i < size; ++i) {
        buffer[i] = Math.random() * 255 | 0;
      }
    }
    function GenRandomBytes(size) {
      if (nodeCrypto) {
        var data = nodeCrypto.randomBytes(size);
        return data;
      } else if (typeof Uint8Array === "function") {
        var data = new Uint8Array(size);
        if (typeof crypto !== "undefined") {
          crypto.getRandomValues(data);
        } else if (typeof msCrypto !== "undefined") {
          msCrypto.getRandomValues(data);
        } else {
          FillRandomBytes(data, size);
        }
        return data;
      } else {
        var data = new Array(size);
        FillRandomBytes(data, size);
        return data;
      }
    }
    function CreateUUID() {
      var data = GenRandomBytes(UUID_SIZE);
      data[6] = data[6] & 0x4f | 0x40;
      data[8] = data[8] & 0xbf | 0x80;
      var result = "";
      for (var offset = 0; offset < UUID_SIZE; ++offset) {
        var byte = data[offset];
        if (offset === 4 || offset === 6 || offset === 8) {
          result += "-";
        }
        if (byte < 16) {
          result += "0";
        }
        result += byte.toString(16).toLowerCase();
      }
      return result;
    }
    function CreateUniqueKey() {
      var key;
      do {
        key = "@@WeakMap@@" + CreateUUID();
      } while (hasOwn.call(keys, key));
      keys[key] = true;
      return key;
    }
    function GetOrCreateWeakMapTable(target, create) {
      if (!hasOwn.call(target, rootKey)) {
        if (!create) {
          return undefined;
        }
        Object.defineProperty(target, rootKey, {value: Object.create(null)});
      }
      return target[rootKey];
    }
    return WeakMap;
  }
  (function(__global) {
    if (typeof __global.Reflect !== "undefined") {
      if (__global.Reflect !== Reflect) {
        for (var p in Reflect) {
          __global.Reflect[p] = Reflect[p];
        }
      }
    } else {
      __global.Reflect = Reflect;
    }
  })(typeof window !== "undefined" ? window : typeof WorkerGlobalScope !== "undefined" ? self : typeof global !== "undefined" ? global : Function("return this;")());
})(Reflect || (Reflect = {}));
