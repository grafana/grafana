/*
  SystemJS AMD Format
  Provides the AMD module format definition at System.format.amd
  as well as a RequireJS-style require on System.require
*/
(function() {
  // AMD Module Format Detection RegEx
  // define([.., .., ..], ...)
  // define(varName); || define(function(require, exports) {}); || define({})
  var amdRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])define\s*\(\s*("[^"]+"\s*,\s*|'[^']+'\s*,\s*)?\s*(\[(\s*(("[^"]+"|'[^']+')\s*,|\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*(\s*("[^"]+"|'[^']+')\s*,?)?(\s*(\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*\s*\]|function\s*|{|[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*\))/;

  hook('fetch', function(fetch) {
    return function(load) {
      if (load.metadata.format === 'amd' 
          && !load.metadata.authorization 
          && load.metadata.scriptLoad !== false)
        load.metadata.scriptLoad = true;
      // script load implies define global leak
      if (load.metadata.scriptLoad && isBrowser)
        this.get('@@amd-helpers').createDefine();
      return fetch.call(this, load);
    };
  });

  hook('instantiate', function(instantiate) {
    return function(load) {
      var loader = this;
      
      if (load.metadata.format == 'amd' || !load.metadata.format && load.source.match(amdRegEx)) {
        load.metadata.format = 'amd';
        
        if (!loader.builder && loader.execute !== false) {
          var removeDefine = this.get('@@amd-helpers').createDefine();

          try {
            __exec.call(loader, load);
          }
          finally {
            removeDefine();
          }

          if (!load.metadata.entry && !load.metadata.bundle)
            throw new TypeError('AMD module ' + load.name + ' did not define');
        }
        else {
          load.metadata.execute = function() {
            return load.metadata.builderExecute.apply(this, arguments);
          };
        }
      }

      return instantiate.call(loader, load);
    };
  });

})();
