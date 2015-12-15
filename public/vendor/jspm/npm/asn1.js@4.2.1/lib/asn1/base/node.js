/* */ 
var Reporter = require('./index').Reporter;
var EncoderBuffer = require('./index').EncoderBuffer;
var assert = require('minimalistic-assert');
var tags = ['seq', 'seqof', 'set', 'setof', 'octstr', 'bitstr', 'objid', 'bool', 'gentime', 'utctime', 'null_', 'enum', 'int', 'ia5str', 'utf8str', 'bmpstr', 'numstr', 'printstr'];
var methods = ['key', 'obj', 'use', 'optional', 'explicit', 'implicit', 'def', 'choice', 'any'].concat(tags);
var overrided = ['_peekTag', '_decodeTag', '_use', '_decodeStr', '_decodeObjid', '_decodeTime', '_decodeNull', '_decodeInt', '_decodeBool', '_decodeList', '_encodeComposite', '_encodeStr', '_encodeObjid', '_encodeTime', '_encodeNull', '_encodeInt', '_encodeBool'];
function Node(enc, parent) {
  var state = {};
  this._baseState = state;
  state.enc = enc;
  state.parent = parent || null;
  state.children = null;
  state.tag = null;
  state.args = null;
  state.reverseArgs = null;
  state.choice = null;
  state.optional = false;
  state.any = false;
  state.obj = false;
  state.use = null;
  state.useDecoder = null;
  state.key = null;
  state['default'] = null;
  state.explicit = null;
  state.implicit = null;
  if (!state.parent) {
    state.children = [];
    this._wrap();
  }
}
module.exports = Node;
var stateProps = ['enc', 'parent', 'children', 'tag', 'args', 'reverseArgs', 'choice', 'optional', 'any', 'obj', 'use', 'alteredUse', 'key', 'default', 'explicit', 'implicit'];
Node.prototype.clone = function clone() {
  var state = this._baseState;
  var cstate = {};
  stateProps.forEach(function(prop) {
    cstate[prop] = state[prop];
  });
  var res = new this.constructor(cstate.parent);
  res._baseState = cstate;
  return res;
};
Node.prototype._wrap = function wrap() {
  var state = this._baseState;
  methods.forEach(function(method) {
    this[method] = function _wrappedMethod() {
      var clone = new this.constructor(this);
      state.children.push(clone);
      return clone[method].apply(clone, arguments);
    };
  }, this);
};
Node.prototype._init = function init(body) {
  var state = this._baseState;
  assert(state.parent === null);
  body.call(this);
  state.children = state.children.filter(function(child) {
    return child._baseState.parent === this;
  }, this);
  assert.equal(state.children.length, 1, 'Root node can have only one child');
};
Node.prototype._useArgs = function useArgs(args) {
  var state = this._baseState;
  var children = args.filter(function(arg) {
    return arg instanceof this.constructor;
  }, this);
  args = args.filter(function(arg) {
    return !(arg instanceof this.constructor);
  }, this);
  if (children.length !== 0) {
    assert(state.children === null);
    state.children = children;
    children.forEach(function(child) {
      child._baseState.parent = this;
    }, this);
  }
  if (args.length !== 0) {
    assert(state.args === null);
    state.args = args;
    state.reverseArgs = args.map(function(arg) {
      if (typeof arg !== 'object' || arg.constructor !== Object)
        return arg;
      var res = {};
      Object.keys(arg).forEach(function(key) {
        if (key == (key | 0))
          key |= 0;
        var value = arg[key];
        res[value] = key;
      });
      return res;
    });
  }
};
overrided.forEach(function(method) {
  Node.prototype[method] = function _overrided() {
    var state = this._baseState;
    throw new Error(method + ' not implemented for encoding: ' + state.enc);
  };
});
tags.forEach(function(tag) {
  Node.prototype[tag] = function _tagMethod() {
    var state = this._baseState;
    var args = Array.prototype.slice.call(arguments);
    assert(state.tag === null);
    state.tag = tag;
    this._useArgs(args);
    return this;
  };
});
Node.prototype.use = function use(item) {
  var state = this._baseState;
  assert(state.use === null);
  state.use = item;
  return this;
};
Node.prototype.optional = function optional() {
  var state = this._baseState;
  state.optional = true;
  return this;
};
Node.prototype.def = function def(val) {
  var state = this._baseState;
  assert(state['default'] === null);
  state['default'] = val;
  state.optional = true;
  return this;
};
Node.prototype.explicit = function explicit(num) {
  var state = this._baseState;
  assert(state.explicit === null && state.implicit === null);
  state.explicit = num;
  return this;
};
Node.prototype.implicit = function implicit(num) {
  var state = this._baseState;
  assert(state.explicit === null && state.implicit === null);
  state.implicit = num;
  return this;
};
Node.prototype.obj = function obj() {
  var state = this._baseState;
  var args = Array.prototype.slice.call(arguments);
  state.obj = true;
  if (args.length !== 0)
    this._useArgs(args);
  return this;
};
Node.prototype.key = function key(newKey) {
  var state = this._baseState;
  assert(state.key === null);
  state.key = newKey;
  return this;
};
Node.prototype.any = function any() {
  var state = this._baseState;
  state.any = true;
  return this;
};
Node.prototype.choice = function choice(obj) {
  var state = this._baseState;
  assert(state.choice === null);
  state.choice = obj;
  this._useArgs(Object.keys(obj).map(function(key) {
    return obj[key];
  }));
  return this;
};
Node.prototype._decode = function decode(input) {
  var state = this._baseState;
  if (state.parent === null)
    return input.wrapResult(state.children[0]._decode(input));
  var result = state['default'];
  var present = true;
  var prevKey;
  if (state.key !== null)
    prevKey = input.enterKey(state.key);
  if (state.optional) {
    var tag = null;
    if (state.explicit !== null)
      tag = state.explicit;
    else if (state.implicit !== null)
      tag = state.implicit;
    else if (state.tag !== null)
      tag = state.tag;
    if (tag === null && !state.any) {
      var save = input.save();
      try {
        if (state.choice === null)
          this._decodeGeneric(state.tag, input);
        else
          this._decodeChoice(input);
        present = true;
      } catch (e) {
        present = false;
      }
      input.restore(save);
    } else {
      present = this._peekTag(input, tag, state.any);
      if (input.isError(present))
        return present;
    }
  }
  var prevObj;
  if (state.obj && present)
    prevObj = input.enterObject();
  if (present) {
    if (state.explicit !== null) {
      var explicit = this._decodeTag(input, state.explicit);
      if (input.isError(explicit))
        return explicit;
      input = explicit;
    }
    if (state.use === null && state.choice === null) {
      if (state.any)
        var save = input.save();
      var body = this._decodeTag(input, state.implicit !== null ? state.implicit : state.tag, state.any);
      if (input.isError(body))
        return body;
      if (state.any)
        result = input.raw(save);
      else
        input = body;
    }
    if (state.any)
      result = result;
    else if (state.choice === null)
      result = this._decodeGeneric(state.tag, input);
    else
      result = this._decodeChoice(input);
    if (input.isError(result))
      return result;
    if (!state.any && state.choice === null && state.children !== null) {
      var fail = state.children.some(function decodeChildren(child) {
        child._decode(input);
      });
      if (fail)
        return err;
    }
  }
  if (state.obj && present)
    result = input.leaveObject(prevObj);
  if (state.key !== null && (result !== null || present === true))
    input.leaveKey(prevKey, state.key, result);
  return result;
};
Node.prototype._decodeGeneric = function decodeGeneric(tag, input) {
  var state = this._baseState;
  if (tag === 'seq' || tag === 'set')
    return null;
  if (tag === 'seqof' || tag === 'setof')
    return this._decodeList(input, tag, state.args[0]);
  else if (tag === 'octstr' || tag === 'bitstr')
    return this._decodeStr(input, tag);
  else if (tag === 'ia5str' || tag === 'utf8str' || tag === 'bmpstr')
    return this._decodeStr(input, tag);
  else if (tag === 'numstr' || tag === 'printstr')
    return this._decodeStr(input, tag);
  else if (tag === 'objid' && state.args)
    return this._decodeObjid(input, state.args[0], state.args[1]);
  else if (tag === 'objid')
    return this._decodeObjid(input, null, null);
  else if (tag === 'gentime' || tag === 'utctime')
    return this._decodeTime(input, tag);
  else if (tag === 'null_')
    return this._decodeNull(input);
  else if (tag === 'bool')
    return this._decodeBool(input);
  else if (tag === 'int' || tag === 'enum')
    return this._decodeInt(input, state.args && state.args[0]);
  else if (state.use !== null)
    return this._getUse(state.use, input._reporterState.obj)._decode(input);
  else
    return input.error('unknown tag: ' + tag);
  return null;
};
Node.prototype._getUse = function _getUse(entity, obj) {
  var state = this._baseState;
  state.useDecoder = this._use(entity, obj);
  assert(state.useDecoder._baseState.parent === null);
  state.useDecoder = state.useDecoder._baseState.children[0];
  if (state.implicit !== state.useDecoder._baseState.implicit) {
    state.useDecoder = state.useDecoder.clone();
    state.useDecoder._baseState.implicit = state.implicit;
  }
  return state.useDecoder;
};
Node.prototype._decodeChoice = function decodeChoice(input) {
  var state = this._baseState;
  var result = null;
  var match = false;
  Object.keys(state.choice).some(function(key) {
    var save = input.save();
    var node = state.choice[key];
    try {
      var value = node._decode(input);
      if (input.isError(value))
        return false;
      result = {
        type: key,
        value: value
      };
      match = true;
    } catch (e) {
      input.restore(save);
      return false;
    }
    return true;
  }, this);
  if (!match)
    return input.error('Choice not matched');
  return result;
};
Node.prototype._createEncoderBuffer = function createEncoderBuffer(data) {
  return new EncoderBuffer(data, this.reporter);
};
Node.prototype._encode = function encode(data, reporter, parent) {
  var state = this._baseState;
  if (state['default'] !== null && state['default'] === data)
    return;
  var result = this._encodeValue(data, reporter, parent);
  if (result === undefined)
    return;
  if (this._skipDefault(result, reporter, parent))
    return;
  return result;
};
Node.prototype._encodeValue = function encode(data, reporter, parent) {
  var state = this._baseState;
  if (state.parent === null)
    return state.children[0]._encode(data, reporter || new Reporter());
  var result = null;
  var present = true;
  this.reporter = reporter;
  if (state.optional && data === undefined) {
    if (state['default'] !== null)
      data = state['default'];
    else
      return;
  }
  var prevKey;
  var content = null;
  var primitive = false;
  if (state.any) {
    result = this._createEncoderBuffer(data);
  } else if (state.choice) {
    result = this._encodeChoice(data, reporter);
  } else if (state.children) {
    content = state.children.map(function(child) {
      if (child._baseState.tag === 'null_')
        return child._encode(null, reporter, data);
      if (child._baseState.key === null)
        return reporter.error('Child should have a key');
      var prevKey = reporter.enterKey(child._baseState.key);
      if (typeof data !== 'object')
        return reporter.error('Child expected, but input is not object');
      var res = child._encode(data[child._baseState.key], reporter, data);
      reporter.leaveKey(prevKey);
      return res;
    }, this).filter(function(child) {
      return child;
    });
    content = this._createEncoderBuffer(content);
  } else {
    if (state.tag === 'seqof' || state.tag === 'setof') {
      if (!(state.args && state.args.length === 1))
        return reporter.error('Too many args for : ' + state.tag);
      if (!Array.isArray(data))
        return reporter.error('seqof/setof, but data is not Array');
      var child = this.clone();
      child._baseState.implicit = null;
      content = this._createEncoderBuffer(data.map(function(item) {
        var state = this._baseState;
        return this._getUse(state.args[0], data)._encode(item, reporter);
      }, child));
    } else if (state.use !== null) {
      result = this._getUse(state.use, parent)._encode(data, reporter);
    } else {
      content = this._encodePrimitive(state.tag, data);
      primitive = true;
    }
  }
  var result;
  if (!state.any && state.choice === null) {
    var tag = state.implicit !== null ? state.implicit : state.tag;
    var cls = state.implicit === null ? 'universal' : 'context';
    if (tag === null) {
      if (state.use === null)
        reporter.error('Tag could be ommited only for .use()');
    } else {
      if (state.use === null)
        result = this._encodeComposite(tag, primitive, cls, content);
    }
  }
  if (state.explicit !== null)
    result = this._encodeComposite(state.explicit, false, 'context', result);
  return result;
};
Node.prototype._encodeChoice = function encodeChoice(data, reporter) {
  var state = this._baseState;
  var node = state.choice[data.type];
  if (!node) {
    assert(false, data.type + ' not found in ' + JSON.stringify(Object.keys(state.choice)));
  }
  return node._encode(data.value, reporter);
};
Node.prototype._encodePrimitive = function encodePrimitive(tag, data) {
  var state = this._baseState;
  if (tag === 'octstr' || tag === 'bitstr' || tag === 'ia5str')
    return this._encodeStr(data, tag);
  else if (tag === 'utf8str' || tag === 'bmpstr')
    return this._encodeStr(data, tag);
  else if (tag === 'numstr' || tag === 'printstr')
    return this._encodeStr(data, tag);
  else if (tag === 'objid' && state.args)
    return this._encodeObjid(data, state.reverseArgs[0], state.args[1]);
  else if (tag === 'objid')
    return this._encodeObjid(data, null, null);
  else if (tag === 'gentime' || tag === 'utctime')
    return this._encodeTime(data, tag);
  else if (tag === 'null_')
    return this._encodeNull();
  else if (tag === 'int' || tag === 'enum')
    return this._encodeInt(data, state.args && state.reverseArgs[0]);
  else if (tag === 'bool')
    return this._encodeBool(data);
  else
    throw new Error('Unsupported tag: ' + tag);
};
Node.prototype._isNumstr = function isNumstr(str) {
  return /^[0-9 ]*$/.test(str);
};
Node.prototype._isPrintstr = function isPrintstr(str) {
  return /^[A-Za-z0-9 '\(\)\+,\-\.\/:=\?]*$/.test(str);
};
