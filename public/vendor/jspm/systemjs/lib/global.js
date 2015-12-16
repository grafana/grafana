/*
  SystemJS Global Format

  Supports
    metadata.deps
    metadata.globals
    metadata.exports

  Without metadata.exports, detects writes to the global object.
*/
var __globalName = typeof self != 'undefined' ? 'self' : 'global';

hook('reduceRegister_', function(reduceRegister) {
  return function(load, register) {
    if (register)
      return reduceRegister.call(this, load, register);

    load.metadata.format = 'global';
    var entry = load.metadata.entry = createEntry();
    var globalValue = readMemberExpression(load.metadata.exports, __global);
    entry.execute = function() {
      return globalValue;
    };
  };
});

hook('fetch', function(fetch) {
  return function(load) {
    if (load.metadata.exports && !load.metadata.format)
      load.metadata.format = 'global';

    // A global with exports, no globals and no deps
    // can be loaded via a script tag
    if (load.metadata.format == 'global' && !load.metadata.authorization
        && load.metadata.exports && !load.metadata.globals 
        && (!load.metadata.deps || load.metadata.deps.length == 0)
        && load.metadata.scriptLoad !== false)
      load.metadata.scriptLoad = true;

    return fetch.call(this, load);
  };
});

// ideally we could support script loading for globals, but the issue with that is that
// we can't do it with AMD support side-by-side since AMD support means defining the
// global define, and global support means not definining it, yet we don't have any hook
// into the "pre-execution" phase of a script tag being loaded to handle both cases


hook('instantiate', function(instantiate) {
  return function(load) {
    var loader = this;

    if (!load.metadata.format)
      load.metadata.format = 'global';

    // globals shorthand support for:
    // globals = ['Buffer'] where we just require 'Buffer' in the current context
    if (load.metadata.globals) {
      if (load.metadata.globals instanceof Array) {
        var globals = {};
        for (var i = 0; i < load.metadata.globals.length; i++)
          globals[load.metadata.globals[i]] = load.metadata.globals[i];
        load.metadata.globals = globals;
      }
    }

    // global is a fallback module format
    if (load.metadata.format == 'global' && !load.metadata.registered) {

      var entry = createEntry();

      load.metadata.entry = entry;

      entry.deps = [];

      for (var g in load.metadata.globals)
        entry.deps.push(load.metadata.globals[g]);

      entry.execute = function(require, exports, module) {

        var globals;
        if (load.metadata.globals) {
          globals = {};
          for (var g in load.metadata.globals)
            globals[g] = require(load.metadata.globals[g]);
        }
        
        var exportName = load.metadata.exports;

        if (exportName)
          load.source += '\n' + __globalName + '["' + exportName + '"] = ' + exportName + ';';

        var retrieveGlobal = loader.get('@@global-helpers').prepareGlobal(module.id, exportName, globals);

        __exec.call(loader, load);

        return retrieveGlobal();
      }
    }
    return instantiate.call(this, load);
  };
});
