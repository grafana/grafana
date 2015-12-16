hookConstructor(function(constructor) {
  return function() {
    var loader = this;
    constructor.call(loader);

    var hasOwnProperty = Object.prototype.hasOwnProperty;

    // bare minimum ignores for IE8
    var ignoredGlobalProps = ['_g', 'sessionStorage', 'localStorage', 'clipboardData', 'frames', 'frameElement', 'external', 'mozAnimationStartTime', 'webkitStorageInfo', 'webkitIndexedDB'];

    var globalSnapshot;

    function forEachGlobal(callback) {
      if (Object.keys)
        Object.keys(__global).forEach(callback);
      else
        for (var g in __global) {
          if (!hasOwnProperty.call(__global, g))
            continue;
          callback(g);
        }
    }

    function forEachGlobalValue(callback) {
      forEachGlobal(function(globalName) {
        if (indexOf.call(ignoredGlobalProps, globalName) != -1)
          return;
        try {
          var value = __global[globalName];
        }
        catch (e) {
          ignoredGlobalProps.push(globalName);
        }
        callback(globalName, value);
      });
    }

    loader.set('@@global-helpers', loader.newModule({
      prepareGlobal: function(moduleName, exportName, globals) {
        // disable module detection
        var curDefine = __global.define;
        
        __global.define = undefined;
        __global.exports = undefined;
        if (__global.module && __global.module.exports)
          __global.module = undefined;

        // set globals
        var oldGlobals;
        if (globals) {
          oldGlobals = {};
          for (var g in globals) {
            oldGlobals[g] = __global[g];
            __global[g] = globals[g];
          }
        }

        // store a complete copy of the global object in order to detect changes
        if (!exportName) {
          globalSnapshot = {};

          forEachGlobalValue(function(name, value) {
            globalSnapshot[name] = value;
          });
        }

        // return function to retrieve global
        return function() {
          var globalValue;

          if (exportName) {
            globalValue = readMemberExpression(exportName, __global);
          }
          else {
            var singleGlobal;
            var multipleExports;
            var exports = {};

            forEachGlobalValue(function(name, value) {
              if (globalSnapshot[name] === value)
                return;
              if (typeof value == 'undefined')
                return;
              exports[name] = value;

              if (typeof singleGlobal != 'undefined') {
                if (!multipleExports && singleGlobal !== value)
                  multipleExports = true;
              }
              else {
                singleGlobal = value;
              }
            });
            globalValue = multipleExports ? exports : singleGlobal;
          }

          // revert globals
          if (oldGlobals) {
            for (var g in oldGlobals)
              __global[g] = oldGlobals[g];
          }
          __global.define = curDefine;

          return globalValue;
        };
      }
    }));
  };
});
