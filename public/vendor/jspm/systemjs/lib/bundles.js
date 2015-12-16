/*
  System bundles

  Allows a bundle module to be specified which will be dynamically 
  loaded before trying to load a given module.

  For example:
  System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']

  Will result in a load to "mybundle" whenever a load to "jquery"
  or "bootstrap/js/bootstrap" is made.

  In this way, the bundle becomes the request that provides the module
*/
function getBundleFor(loader, name) {
  // check if it is in an already-loaded bundle
  for (var b in loader.loadedBundles_)
    if (indexOf.call(loader.bundles[b], name) != -1)
      return Promise.resolve(b);

  // check if it is a new bundle
  for (var b in loader.bundles)
    if (indexOf.call(loader.bundles[b], name) != -1)
      return loader.normalize(b)
      .then(function(normalized) {
        loader.bundles[normalized] = loader.bundles[b];
        loader.loadedBundles_[normalized] = true;
        return normalized;
      });

  return Promise.resolve();
}

(function() {
  // bundles support (just like RequireJS)
  // bundle name is module name of bundle itself
  // bundle is array of modules defined by the bundle
  // when a module in the bundle is requested, the bundle is loaded instead
  // of the form System.bundles['mybundle'] = ['jquery', 'bootstrap/js/bootstrap']
  hookConstructor(function(constructor) {
    return function() {
      constructor.call(this);
      this.bundles = {};
      this.loadedBundles_ = {};
    };
  });

  // assign bundle metadata for bundle loads
  hook('locate', function(locate) {
    return function(load) {
      var loader = this;
      if (load.name in loader.loadedBundles_ || load.name in loader.bundles)
        load.metadata.bundle = true;

      // if not already defined, check if we need to load a bundle
      if (!(load.name in loader.defined))
        return getBundleFor(loader, load.name)
        .then(function(bundleName) {
          if (bundleName)
            return loader.load(bundleName);
        })
        .then(function() {
          return locate.call(loader, load);
        });

      return locate.call(this, load);
    };
  });
})();
