var absURLRegEx = /^[^\/]+:\/\//;

function readMemberExpression(p, value) {
  var pParts = p.split('.');
  while (pParts.length)
    value = value[pParts.shift()];
  return value;
}

var baseURLCache = {};
function getBaseURLObj() {
  if (baseURLCache[this.baseURL])
    return baseURLCache[this.baseURL];

  // normalize baseURL if not already
  if (this.baseURL[this.baseURL.length - 1] != '/')
    this.baseURL += '/';

  var baseURL = new URL(this.baseURL, baseURI);

  this.baseURL = baseURL.href;

  return (baseURLCache[this.baseURL] = baseURL);
}

var baseURIObj = new URL(baseURI);

hookConstructor(function(constructor) {
  return function() {
    constructor.call(this);

    // support baseURL
    this.baseURL = baseURI.substr(0, baseURI.lastIndexOf('/') + 1);

    // global behaviour flags
    this.warnings = false;
    this.defaultJSExtensions = false;
    this.globalEvaluationScope = true;
    this.pluginFirst = false;

    // Default settings for globalEvaluationScope:
    // Disabled for WebWorker, Chrome Extensions and jsdom
    if (isWorker 
        || isBrowser && window.chrome && window.chrome.extension 
        || isBrowser && navigator.userAgent.match(/^Node\.js/))
      this.globalEvaluationScope = false;

    // support the empty module, as a concept
    this.set('@empty', this.newModule({}));
  };
});

/*
  Normalization

  If a name is relative, we apply URL normalization to the page
  If a name is an absolute URL, we leave it as-is

  Plain names (neither of the above) run through the map and package
  normalization phases (applying before and after this one).

  The paths normalization phase applies last (paths extension), which
  defines the `normalizeSync` function and normalizes everything into
  a URL.

  The final normalization 
 */
hook('normalize', function(normalize) {
  return function(name, parentName) {
    // first run map config
    name = normalize.apply(this, arguments);
    
    // relative URL-normalization
    if (name[0] == '.' || name[0] == '/') {
      if (parentName)
        return new URL(name, parentName.replace(/#/g, '%05')).href.replace(/%05/g, '#');
      else
        return new URL(name, baseURIObj).href;
    }
    return name;
  };
});

// percent encode just '#' in urls if using HTTP requests
var httpRequest = typeof XMLHttpRequest != 'undefined';
hook('locate', function(locate) {
  return function(load) {
    return Promise.resolve(locate.call(this, load))
    .then(function(address) {
      if (httpRequest)
        return address.replace(/#/g, '%23');
      return address;
    });
  };
});

/*
 * Fetch with authorization
 */
hook('fetch', function() {
  return function(load) {
    return new Promise(function(resolve, reject) {
      fetchTextFromURL(load.address, load.metadata.authorization, resolve, reject);
    });
  };
});

/*
  __useDefault
  
  When a module object looks like:
  newModule(
    __useDefault: true,
    default: 'some-module'
  })

  Then importing that module provides the 'some-module'
  result directly instead of the full module.

  Useful for eg module.exports = function() {}
*/
hook('import', function(systemImport) {
  return function(name, parentName, parentAddress) {
    if (parentName && parentName.name)
      warn.call(this, 'System.import(name, { name: parentName }) is deprecated for System.import(name, parentName), while importing ' + name + ' from ' + parentName.name);
    return systemImport.call(this, name, parentName, parentAddress).then(function(module) {
      return module.__useDefault ? module['default'] : module;
    });
  };
});

/*
 Extend config merging one deep only

  loader.config({
    some: 'random',
    config: 'here',
    deep: {
      config: { too: 'too' }
    }
  });

  <=>

  loader.some = 'random';
  loader.config = 'here'
  loader.deep = loader.deep || {};
  loader.deep.config = { too: 'too' };


  Normalizes meta and package configs allowing for:

  System.config({
    meta: {
      './index.js': {}
    }
  });

  To become

  System.meta['https://thissite.com/index.js'] = {};

  For easy normalization canonicalization with latest URL support.

*/
SystemJSLoader.prototype.config = function(cfg) {
  if ('warnings' in cfg)
    this.warnings = cfg.warnings;

  // always configure baseURL first
  if (cfg.baseURL) {
    var hasConfig = false;
    function checkHasConfig(obj) {
      for (var p in obj)
        return true;
    }
    if (checkHasConfig(this.packages) || checkHasConfig(this.meta) || checkHasConfig(this.depCache) || checkHasConfig(this.bundles) || checkHasConfig(this.packageConfigPaths))
      throw new TypeError('baseURL should only be configured once and must be configured first.');

    this.baseURL = cfg.baseURL;

    // sanitize baseURL
    getBaseURLObj.call(this);
  }

  if (cfg.defaultJSExtensions) {
    this.defaultJSExtensions = cfg.defaultJSExtensions;
    warn.call(this, 'The defaultJSExtensions configuration option is deprecated, use packages configuration instead.');
  }

  if (cfg.pluginFirst)
    this.pluginFirst = cfg.pluginFirst;

  if (cfg.paths) {
    for (var p in cfg.paths)
      this.paths[p] = cfg.paths[p];
  }

  if (cfg.map) {
    var objMaps = '';
    for (var p in cfg.map) {
      var v = cfg.map[p];

      // object map backwards-compat into packages configuration
      if (typeof v !== 'string') {
        objMaps += (objMaps.length ? ', ' : '') + '"' + p + '"';
        var normalized = this.normalizeSync(p);

        // if doing default js extensions, undo to get package name
        if (this.defaultJSExtensions && p.substr(p.length - 3, 3) != '.js')
          normalized = normalized.substr(0, normalized.length - 3);

        // if a package main, revert it
        var pkgMatch = '';
        for (var pkg in this.packages) {
          if (normalized.substr(0, pkg.length) == pkg 
              && (!normalized[pkg.length] || normalized[pkg.length] == '/') 
              && pkgMatch.split('/').length < pkg.split('/').length)
            pkgMatch = pkg;
        }
        if (pkgMatch && this.packages[pkgMatch].main)
          normalized = normalized.substr(0, normalized.length - this.packages[pkgMatch].main.length - 1);

        var pkg = this.packages[normalized] = this.packages[normalized] || {};
        pkg.map = v;
      }
      else {
        this.map[p] = v;
      }
    }
    if (objMaps)
      warn.call(this, 'The map configuration for ' + objMaps + ' uses object submaps, which is deprecated in global map.\nUpdate this to use package contextual map with configs like System.config({ packages: { "' + p + '": { map: {...} } } }).');
  }

  if (cfg.packageConfigPaths) {
    var packageConfigPaths = [];
    for (var i = 0; i < cfg.packageConfigPaths.length; i++) {
      var path = cfg.packageConfigPaths[i];
      var packageLength = Math.max(path.lastIndexOf('*') + 1, path.lastIndexOf('/'));
      var normalized = this.normalizeSync(path.substr(0, packageLength) + '/');
      if (this.defaultJSExtensions && path.substr(path.length - 3, 3) != '.js')
        normalized = normalized.substr(0, normalized.length - 3);
      packageConfigPaths[i] = normalized.substr(0, normalized.length - 1) + path.substr(packageLength);
    }
    this.packageConfigPaths = packageConfigPaths;
  }

  if (cfg.packages) {
    for (var p in cfg.packages) {
      if (p.match(/^([^\/]+:)?\/\/$/))
        throw new TypeError('"' + p + '" is not a valid package name.');

      // request with trailing "/" to get package name exactly
      var prop = this.normalizeSync(p + (p[p.length - 1] != '/' ? '/' : ''));
      prop = prop.substr(0, prop.length - 1);

      // if doing default js extensions, undo to get package name
      // (unless already a package which would have skipped extension)
      if (!this.packages[prop] && this.defaultJSExtensions && p.substr(p.length - 3, 3) != '.js')
        prop = prop.substr(0, prop.length - 3);

      this.packages[prop] = this.packages[prop] || {};

      // meta backwards compatibility
      if (cfg.packages[p].meta) {
        warn.call(this, 'Package ' + p + ' is configured with meta, which is deprecated as it has been renamed to modules.');
        cfg.packages[p].modules = cfg.packages[p].meta;
        delete cfg.packages[p].meta;
      }

      for (var q in cfg.packages[p])
        if (indexOf.call(packageProperties, q) == -1)
          warn.call(this, '"' + q + '" is not a valid package configuration option in package ' + p);

      extendMeta(this.packages[prop], cfg.packages[p]);
    }
  }

  if (cfg.bundles) {
    for (var p in cfg.bundles) {
      var bundle = [];
      for (var i = 0; i < cfg.bundles[p].length; i++)
        bundle.push(this.normalizeSync(cfg.bundles[p][i]));
      this.bundles[p] = bundle;
    }
  }

  for (var c in cfg) {
    var v = cfg[c];
    var normalizeProp = false, normalizeValArray = false;

    if (c == 'baseURL' || c == 'map' || c == 'packages' || c == 'bundles' || c == 'paths' || c == 'warnings' || c == 'packageConfigPaths')
      continue;

    if (typeof v != 'object' || v instanceof Array) {
      this[c] = v;
    }
    else {
      this[c] = this[c] || {};

      if (c == 'meta' || c == 'depCache')
        normalizeProp = true;

      for (var p in v) {
        if (c == 'meta' && p[0] == '*')
          this[c][p] = v[p];
        else if (normalizeProp)
          this[c][this.normalizeSync(p)] = v[p];
        else
          this[c][p] = v[p];
      }
    }
  }
};