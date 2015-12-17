/*
 * Extension to detect ES6 and auto-load Traceur or Babel for processing
 */
(function() {
  // good enough ES6 module detection regex - format detections not designed to be accurate, but to handle the 99% use case
  var esmRegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;

  var traceurRuntimeRegEx = /\$traceurRuntime\s*\./;
  var babelHelpersRegEx = /babelHelpers\s*\./;

  hook('translate', function(translate) {
    return function(load) {
      var loader = this;
      return translate.call(loader, load)
      .then(function(source) {
        // detect & transpile ES6
        if (load.metadata.format == 'esm' || load.metadata.format == 'es6' || !load.metadata.format && source.match(esmRegEx)) {
          if (load.metadata.format == 'es6')
            warn.call(loader, 'Module ' + load.name + ' has metadata setting its format to "es6", which is deprecated.\nThis should be updated to "esm".');
          load.metadata.format = 'esm';

          if (loader.transpiler === false)
            throw new TypeError('Unable to dynamically transpile ES module as System.transpiler set to false.');

          // setting loadedTranspiler_ = false tells the next block to
          // do checks for setting transpiler metadata
          loader.loadedTranspiler_ = loader.loadedTranspiler_ || false;
          if (loader.pluginLoader)
            loader.pluginLoader.loadedTranspiler_ = loader.loadedTranspiler_ || false;

          // builder support
          if (loader.builder)
            load.metadata.originalSource = load.source;

          // defined in es6-module-loader/src/transpile.js
          return transpile.call(loader, load)
          .then(function(source) {
            // clear sourceMap as transpiler embeds it
            load.metadata.sourceMap = undefined;
            return source;
          });
        }

        // load the transpiler correctly
        if (loader.loadedTranspiler_ === false && load.name == loader.normalizeSync(loader.transpiler)) {
          warn.call(loader, 'Note that internal transpilation via System.transpiler has been deprecated for transpiler plugins.');

          // always load transpiler as a global
          if (source.length > 100) {
            load.metadata.format = load.metadata.format || 'global';

            if (loader.transpiler === 'traceur')
              load.metadata.exports = 'traceur';
            if (loader.transpiler === 'typescript')
              load.metadata.exports = 'ts';
          }

          loader.loadedTranspiler_ = true;
        }

        // load the transpiler runtime correctly
        if (loader.loadedTranspilerRuntime_ === false) {
          if (load.name == loader.normalizeSync('traceur-runtime')
              || load.name == loader.normalizeSync('babel/external-helpers*')) {
            if (source.length > 100)
              load.metadata.format = load.metadata.format || 'global';

            loader.loadedTranspilerRuntime_ = true;
          }
        }

        // detect transpiler runtime usage to load runtimes
        if ((load.metadata.format == 'register' || load.metadata.bundle) && loader.loadedTranspilerRuntime_ !== true) {
          if (!__global.$traceurRuntime && load.source.match(traceurRuntimeRegEx)) {
            loader.loadedTranspilerRuntime_ = loader.loadedTranspilerRuntime_ || false;
            return loader['import']('traceur-runtime').then(function() {
              return source;
            });
          }
          if (!__global.babelHelpers && load.source.match(babelHelpersRegEx)) {
            loader.loadedTranspilerRuntime_ = loader.loadedTranspilerRuntime_ || false;
            return loader['import']('babel/external-helpers').then(function() {
              return source;
            });
          }
        }

        return source;
      });
    };
  });

})();
