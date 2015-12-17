if (typeof Promise === 'undefined')
  require('when/es6-shim/Promise');
if (typeof URL === 'undefined')
  require('es6-module-loader/src/url-polyfill');

var version = require('./package.json').version;

var isWindows = process.platform.match(/^win/);

// set transpiler paths in Node
var nodeResolver = typeof process != 'undefined' && typeof require != 'undefined' && require.resolve;
function configNodePath(loader, module, nodeModule, wildcard) {
  if (loader.paths[module])
    return;

  var ext = wildcard ? '/package.json' : '';
  try {
    var match = nodeResolver(nodeModule + ext).replace(/\\/g, '/');
  }
  catch(e) {}
  
  if (match)
    loader.paths[module] = 'file://' + (isWindows ? '/' : '') + match.substr(0, match.length - ext.length) + (wildcard ? '/*.js' : '');
}

var SystemJSLoader = require('./dist/system.src').constructor;

// standard class extend SystemJSLoader to SystemJSNodeLoader
function SystemJSNodeLoaderProto() {}
SystemJSNodeLoaderProto.prototype = SystemJSLoader.prototype;

function SystemJSNodeLoader() {
  SystemJSLoader.call(this);

  if (nodeResolver) {
    configNodePath(this, 'traceur', 'traceur/bin/traceur.js');
    configNodePath(this, 'traceur-runtime', 'traceur/bin/traceur-runtime.js');
    configNodePath(this, 'babel', 'babel-core/browser.js');
    configNodePath(this, 'babel/external-helpers', 'babel-core/external-helpers.js');
    configNodePath(this, 'babel-runtime/*', 'babel-runtime', true);
  }
}
SystemJSNodeLoader.prototype = new SystemJSNodeLoaderProto();
SystemJSNodeLoader.prototype.constructor = SystemJSNodeLoader;

var System = new SystemJSNodeLoader();

System.version = version + ' Node';

module.exports = global.System = System;