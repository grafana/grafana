var module = require('module');
var Module = module.Module;
var NativeModule = require('./node-lib/native_module');
var isv010 = require('../isv010.js');


var realRequire = Module.prototype.require;
Module.prototype._realRequire = realRequire;

function load(path) {
  switch (path) {
    case 'buffer':
      return realRequire.apply(this, arguments);

    case 'module':
      return module;

    default:
      if (NativeModule.exists(path))
        return NativeModule.require(path);
      else
        return realRequire.apply(this, arguments);
  }
}

Module.prototype.require = zone.root.bindCallback(
    this, load, zone.root, {autoRelease: false, name: 'Module.require'});
